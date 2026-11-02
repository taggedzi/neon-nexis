<?php
declare(strict_types=1);

const NEON_COOP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const NEON_COOP_CODE_LENGTH = 5;

function neon_coop_pdo(string $path): PDO
{
  $directory = dirname($path);
  if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
    throw new RuntimeException('Co-op database directory is unavailable');
  }
  $pdo = new PDO('sqlite:' . $path, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  $pdo->exec('PRAGMA busy_timeout = 3000');
  $pdo->exec(
    'CREATE TABLE IF NOT EXISTS lobbies (
      code TEXT PRIMARY KEY,
      host_id TEXT NOT NULL,
      guest_id TEXT,
      host_card TEXT,
      guest_card TEXT,
      created_at INTEGER NOT NULL,
      checked_in_at INTEGER NOT NULL
    )'
  );
  $columns = $pdo->query('PRAGMA table_info(lobbies)')->fetchAll(PDO::FETCH_COLUMN, 1);
  if (!in_array('protocol', $columns, true)) {
    $pdo->exec('ALTER TABLE lobbies ADD COLUMN protocol INTEGER NOT NULL DEFAULT 1');
  }
  if (!in_array('roster', $columns, true)) {
    $pdo->exec('ALTER TABLE lobbies ADD COLUMN roster TEXT');
  }
  $pdo->exec('CREATE TABLE IF NOT EXISTS coop_seats (
    code TEXT NOT NULL, seat INTEGER NOT NULL, client_id TEXT NOT NULL,
    guest_card TEXT, host_card TEXT,
    PRIMARY KEY (code, seat), UNIQUE (code, client_id)
  )');
  neon_coop_delete_stale($pdo, time());
  $pdo->exec('DELETE FROM coop_seats WHERE code NOT IN (SELECT code FROM lobbies)');
  return $pdo;
}

function neon_coop_delete_stale(PDO $pdo, int $now): void
{
  $stmt = $pdo->prepare('DELETE FROM lobbies WHERE checked_in_at <= :cutoff');
  $stmt->execute(['cutoff' => $now - NEON_COOP_STALE_SECONDS]);
}

function neon_coop_delete_aged(PDO $pdo, int $now): void
{
  $stmt = $pdo->prepare('DELETE FROM lobbies WHERE created_at <= :cutoff');
  $stmt->execute(['cutoff' => $now - NEON_COOP_MAX_AGE_SECONDS]);
}

function neon_coop_allocate_code(PDO $pdo): string
{
  for ($attempt = 0; $attempt < 24; $attempt++) {
    $code = '';
    for ($index = 0; $index < NEON_COOP_CODE_LENGTH; $index++) {
      $code .= NEON_COOP_CODE_ALPHABET[random_int(0, strlen(NEON_COOP_CODE_ALPHABET) - 1)];
    }
    $stmt = $pdo->prepare('SELECT 1 FROM lobbies WHERE code = :code');
    $stmt->execute(['code' => $code]);
    if ($stmt->fetchColumn() === false) {
      return $code;
    }
  }
  throw new RuntimeException('Unable to allocate a room code');
}

function neon_coop_row(PDO $pdo, string $code): ?array
{
  $stmt = $pdo->prepare('SELECT * FROM lobbies WHERE code = :code');
  $stmt->execute(['code' => $code]);
  $row = $stmt->fetch();
  return $row === false ? null : $row;
}

function neon_coop_create_lobby(PDO $pdo, string $hostId, int $now): array
{
  $code = neon_coop_allocate_code($pdo);
  $stmt = $pdo->prepare(
    'INSERT INTO lobbies (code, host_id, guest_id, host_card, guest_card, created_at, checked_in_at, protocol)
     VALUES (:code, :host, NULL, NULL, NULL, :created, :checked, 2)'
  );
  $stmt->execute([
    'code' => $code,
    'host' => $hostId,
    'created' => $now,
    'checked' => $now,
  ]);
  return neon_coop_row($pdo, $code);
}

function neon_coop_check_in(PDO $pdo, string $code, string $clientId, int $now): ?array
{
  $row = neon_coop_row($pdo, $code);
  if ($row === null || $row['host_id'] !== $clientId) {
    return null;
  }
  $stmt = $pdo->prepare(
    'UPDATE lobbies SET checked_in_at = :now WHERE code = :code AND host_id = :host'
  );
  $stmt->execute(['now' => $now, 'code' => $code, 'host' => $clientId]);
  return neon_coop_row($pdo, $code);
}

function neon_coop_seats(PDO $pdo, string $code): array
{
  $stmt = $pdo->prepare('SELECT * FROM coop_seats WHERE code = :code ORDER BY seat');
  $stmt->execute(['code' => $code]);
  return $stmt->fetchAll();
}

function neon_coop_join(PDO $pdo, string $code, string $clientId): array
{
  // Serialize allocation so concurrent joins cannot claim the same final seat.
  $pdo->exec('BEGIN IMMEDIATE');
  try {
    $row = neon_coop_row($pdo, $code);
    if ($row === null || $row['host_id'] === $clientId) {
      return ['ok' => false, 'error' => 'notfound'];
    }
    if ((int) $row['protocol'] !== 2) {
      return ['ok' => false, 'error' => 'version'];
    }
    $roster = $row['roster'] === null ? null : json_decode($row['roster'], true);
    if ($roster !== null && !array_key_exists($clientId, $roster)) {
      return ['ok' => false, 'error' => 'locked'];
    }
    $seats = neon_coop_seats($pdo, $code);
    foreach ($seats as $member) {
      if ($member['client_id'] === $clientId) {
        return ['ok' => true, 'row' => $row, 'seat' => (int) $member['seat']];
      }
    }
    $occupied = array_map('intval', array_column($seats, 'seat'));
    $seat = $roster === null ? null : (int) $roster[$clientId];
    if ($seat === null) {
      foreach ([1, 2, 3] as $candidate) {
        if (!in_array($candidate, $occupied, true)) { $seat = $candidate; break; }
      }
    }
    if ($seat === null || in_array($seat, $occupied, true)) {
      return ['ok' => false, 'error' => 'full'];
    }
    $stmt = $pdo->prepare('INSERT INTO coop_seats (code, seat, client_id) VALUES (:code, :seat, :client)');
    $stmt->execute(['code' => $code, 'seat' => $seat, 'client' => $clientId]);
    return ['ok' => true, 'row' => $row, 'seat' => $seat];
  } finally {
    $pdo->exec('COMMIT');
  }
}

function neon_coop_roster(PDO $pdo, string $code, string $clientId, mixed $roster): bool
{
  $row = neon_coop_row($pdo, $code);
  if ($row === null || $row['host_id'] !== $clientId) return false;
  if ($roster !== null) {
    if (!is_array($roster) || count($roster) > 3) return false;
    $available = [];
    foreach (neon_coop_seats($pdo, $code) as $member) {
      $available[$member['client_id']] = (int) $member['seat'];
    }
    foreach ($roster as $id => $seat) {
      if (!isset($available[$id]) || $available[$id] !== $seat) return false;
    }
  }
  $stmt = $pdo->prepare('UPDATE lobbies SET roster = :roster WHERE code = :code');
  $stmt->execute(['roster' => $roster === null ? null : json_encode((object) $roster, JSON_THROW_ON_ERROR), 'code' => $code]);
  return true;
}

function neon_coop_leave(PDO $pdo, string $code, string $clientId): array
{
  $row = neon_coop_row($pdo, $code);
  if ($row === null) return ['ok' => false, 'error' => 'notfound'];
  if ($row['host_id'] === $clientId) {
    $stmt = $pdo->prepare('DELETE FROM lobbies WHERE code = :code');
    $stmt->execute(['code' => $code]);
    $stmt = $pdo->prepare('DELETE FROM coop_seats WHERE code = :code');
    $stmt->execute(['code' => $code]);
    return ['ok' => true, 'deleted' => true];
  }
  $stmt = $pdo->prepare('DELETE FROM coop_seats WHERE code = :code AND client_id = :client');
  $stmt->execute(['code' => $code, 'client' => $clientId]);
  return ['ok' => $stmt->rowCount() > 0, 'deleted' => false];
}

function neon_coop_sanitize_card(array $card, string $clientId, int $rev): array
{
  $sdp = null;
  if (isset($card['sdp']) && is_array($card['sdp'])) {
    $type = (string) ($card['sdp']['type'] ?? '');
    $text = (string) ($card['sdp']['sdp'] ?? '');
    if (($type === 'offer' || $type === 'answer') && $text !== '' && strlen($text) <= 50000) {
      $sdp = ['type' => $type, 'sdp' => $text];
    }
  }
  $candidates = [];
  if (isset($card['candidates']) && is_array($card['candidates'])) {
    foreach ($card['candidates'] as $candidate) {
      if (!is_array($candidate) || count($candidates) >= 64) {
        continue;
      }
      $clean = [];
      foreach (['candidate', 'sdpMid', 'sdpMLineIndex', 'usernameFragment'] as $key) {
        if (array_key_exists($key, $candidate)) {
          $clean[$key] = $candidate[$key];
        }
      }
      if (isset($clean['candidate']) && is_string($clean['candidate'])) {
        $candidates[] = $clean;
      }
    }
  }
  return [
    'rev' => $rev,
    'session' => substr((string) ($card['session'] ?? ''), 0, 32),
    'sdp' => $sdp,
    'candidates' => $candidates,
    'clientId' => $clientId,
    'profile' => neon_coop_profile($card['profile'] ?? null),
  ];
}

function neon_coop_put_card(PDO $pdo, string $code, string $clientId, array $card, int $now, string $targetId = ''): ?array
{
  $row = neon_coop_row($pdo, $code);
  if ($row === null || (int) $row['protocol'] !== 2) return null;
  $isHost = $row['host_id'] === $clientId;
  $memberId = $isHost ? $targetId : $clientId;
  $stmt = $pdo->prepare('SELECT * FROM coop_seats WHERE code = :code AND client_id = :client');
  $stmt->execute(['code' => $code, 'client' => $memberId]);
  $member = $stmt->fetch();
  if (!$member) return null;
  $column = $isHost ? 'host_card' : 'guest_card';
  $previous = neon_coop_decode_card($member[$column]);
  $rev = $previous ? (int) $previous['rev'] + 1 : 1;
  $stored = neon_coop_sanitize_card($card, $clientId, $rev);
  $stored['seat'] = $isHost ? 0 : (int) $member['seat'];
  $stored['protocol'] = 2;
  $json = json_encode($stored, JSON_THROW_ON_ERROR);
  if (strlen($json) > 65536) return null;
  $stmt = $pdo->prepare('UPDATE coop_seats SET ' . $column . ' = :card WHERE code = :code AND client_id = :client');
  $stmt->execute(['card' => $json, 'code' => $code, 'client' => $memberId]);
  if ($isHost) neon_coop_check_in($pdo, $code, $clientId, $now);
  return $stored;
}

function neon_coop_decode_card(mixed $json): ?array
{
  if (!is_string($json) || $json === '') {
    return null;
  }
  $card = json_decode($json, true);
  return is_array($card) ? $card : null;
}

function neon_coop_poll(PDO $pdo, string $code, string $clientId, mixed $sinceRev, int $now): ?array
{
  $row = neon_coop_row($pdo, $code);
  if ($row === null || (int) $row['protocol'] !== 2) return null;
  $isHost = $row['host_id'] === $clientId;
  $roster = $row['roster'] === null ? null : json_decode($row['roster'], true);
  if (!$isHost && $roster !== null && !array_key_exists($clientId, $roster)) {
    return ['ok' => false, 'error' => 'locked', 'protocol' => 2];
  }
  $peers = [];
  $ownSeat = 0;
  foreach (neon_coop_seats($pdo, $code) as $member) {
    if (!$isHost && $member['client_id'] !== $clientId) continue;
    $id = $isHost ? $member['client_id'] : $row['host_id'];
    $card = neon_coop_decode_card($member[$isHost ? 'guest_card' : 'host_card']);
    $since = is_array($sinceRev) ? (int) ($sinceRev[$id] ?? 0) : (int) $sinceRev;
    $peers[] = ['clientId' => $id, 'seat' => $isHost ? (int) $member['seat'] : 0,
      'card' => $card && (int) $card['rev'] > $since ? $card : null];
    if (!$isHost) $ownSeat = (int) $member['seat'];
  }
  if (!$isHost && $ownSeat === 0) return null;
  if ($isHost) neon_coop_check_in($pdo, $code, $clientId, $now);
  return ['ok' => true, 'code' => $code, 'protocol' => 2,
    'role' => $isHost ? 'host' : 'guest', 'hostId' => $row['host_id'],
    'seat' => $ownSeat, 'peers' => $peers];
}
