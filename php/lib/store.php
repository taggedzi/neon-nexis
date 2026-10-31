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
  neon_coop_delete_stale($pdo, time());
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
  $stmt = $pdo->prepare('SELECT code, host_id, guest_id, host_card, guest_card, created_at, checked_in_at FROM lobbies WHERE code = :code');
  $stmt->execute(['code' => $code]);
  $row = $stmt->fetch();
  return $row === false ? null : $row;
}

function neon_coop_create_lobby(PDO $pdo, string $hostId, int $now): array
{
  $code = neon_coop_allocate_code($pdo);
  $stmt = $pdo->prepare(
    'INSERT INTO lobbies (code, host_id, guest_id, host_card, guest_card, created_at, checked_in_at)
     VALUES (:code, :host, NULL, NULL, NULL, :created, :checked)'
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

function neon_coop_join(PDO $pdo, string $code, string $clientId): array
{
  $row = neon_coop_row($pdo, $code);
  if ($row === null || $row['host_id'] === $clientId) {
    return ['ok' => false, 'error' => 'notfound'];
  }
  if ($row['guest_id'] !== null && $row['guest_id'] !== '' && $row['guest_id'] !== $clientId) {
    return ['ok' => false, 'error' => 'full'];
  }
  $stmt = $pdo->prepare('UPDATE lobbies SET guest_id = :guest WHERE code = :code');
  $stmt->execute(['guest' => $clientId, 'code' => $code]);
  return ['ok' => true, 'row' => neon_coop_row($pdo, $code)];
}

function neon_coop_leave(PDO $pdo, string $code, string $clientId): array
{
  $row = neon_coop_row($pdo, $code);
  if ($row === null) {
    return ['ok' => false, 'error' => 'notfound'];
  }
  if ($row['host_id'] === $clientId) {
    $stmt = $pdo->prepare('DELETE FROM lobbies WHERE code = :code');
    $stmt->execute(['code' => $code]);
    return ['ok' => true, 'deleted' => true];
  }
  if ($row['guest_id'] === $clientId) {
    $stmt = $pdo->prepare('UPDATE lobbies SET guest_id = NULL, guest_card = NULL WHERE code = :code');
    $stmt->execute(['code' => $code]);
    return ['ok' => true, 'deleted' => false, 'row' => neon_coop_row($pdo, $code)];
  }
  return ['ok' => false, 'error' => 'notfound'];
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

function neon_coop_put_card(PDO $pdo, string $code, string $clientId, array $card, int $now): ?array
{
  $row = neon_coop_row($pdo, $code);
  if ($row === null) {
    return null;
  }
  if ($row['host_id'] === $clientId) {
    $column = 'host_card';
  } elseif ($row['guest_id'] === $clientId) {
    $column = 'guest_card';
  } else {
    return null;
  }
  $previous = json_decode((string) ($row[$column] ?? ''), true);
  $rev = is_array($previous) && isset($previous['rev']) ? ((int) $previous['rev']) + 1 : 1;
  $stored = neon_coop_sanitize_card($card, $clientId, $rev);
  $json = json_encode($stored, JSON_THROW_ON_ERROR);
  if (strlen($json) > 65536) {
    return null;
  }
  if ($column === 'host_card') {
    $stmt = $pdo->prepare('UPDATE lobbies SET host_card = :card, checked_in_at = :now WHERE code = :code AND host_id = :client');
    $stmt->execute(['card' => $json, 'now' => $now, 'code' => $code, 'client' => $clientId]);
  } else {
    $stmt = $pdo->prepare('UPDATE lobbies SET guest_card = :card WHERE code = :code AND guest_id = :client');
    $stmt->execute(['card' => $json, 'code' => $code, 'client' => $clientId]);
  }
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

function neon_coop_poll(PDO $pdo, string $code, string $clientId, int $sinceRev, int $now): ?array
{
  $row = neon_coop_row($pdo, $code);
  if ($row === null) {
    return null;
  }
  if ($row['host_id'] === $clientId) {
    neon_coop_check_in($pdo, $code, $clientId, $now);
    $row = neon_coop_row($pdo, $code);
    $role = 'host';
    $self = neon_coop_decode_card($row['host_card']);
    $peer = neon_coop_decode_card($row['guest_card']);
  } elseif ($row['guest_id'] === $clientId) {
    $role = 'guest';
    $self = neon_coop_decode_card($row['guest_card']);
    $peer = neon_coop_decode_card($row['host_card']);
  } else {
    return null;
  }
  $peerRev = is_array($peer) ? (int) ($peer['rev'] ?? 0) : 0;
  return [
    'ok' => true,
    'code' => $row['code'],
    'role' => $role,
    'hostId' => $row['host_id'],
    'guestId' => $row['guest_id'],
    'selfRev' => is_array($self) ? (int) ($self['rev'] ?? 0) : 0,
    'peerCard' => $peerRev > $sinceRev ? $peer : null,
  ];
}
