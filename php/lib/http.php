<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/credentials.php';
require_once __DIR__ . '/store.php';

function neon_coop_json(int $status, array $body): void
{
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  header('X-Content-Type-Options: nosniff');
  echo json_encode($body, JSON_THROW_ON_ERROR);
}

function neon_coop_request(): array
{
  $raw = file_get_contents('php://input');
  $body = [];
  if (is_string($raw) && $raw !== '') {
    if (strlen($raw) > 65536) {
      throw new RuntimeException('Payload is too large');
    }
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
      $body = $decoded;
    }
  }
  $action = $_GET['action'] ?? ($body['action'] ?? '');
  $body['action'] = is_string($action) ? $action : '';
  return $body;
}

function neon_coop_status(array $config, string $clientId): array
{
  $enabledFlag = ($config['enabled'] ?? false) === true;
  $configured = $config['iceServers'] ?? [];
  if (!$enabledFlag) {
    return ['ok' => true, 'enabled' => false, 'iceServers' => [], 'reason' => 'disabled'];
  }
  if (!is_array($configured) || $configured === []) {
    return ['ok' => true, 'enabled' => false, 'iceServers' => [], 'reason' => 'empty'];
  }
  $servers = neon_coop_ice_servers($config, $clientId);
  if (!neon_coop_enabled($config, $servers)) {
    return ['ok' => true, 'enabled' => false, 'iceServers' => [], 'reason' => 'empty'];
  }
  return ['ok' => true, 'enabled' => true, 'iceServers' => $servers];
}

function neon_coop_handle_http(): void
{
  try {
    $request = neon_coop_request();
    $config = neon_coop_load_config();
    $action = (string) $request['action'];
    $clientId = neon_coop_client_id($request['clientId'] ?? ($_GET['clientId'] ?? ''));
    if ($action === '' || $action === 'status') {
      neon_coop_json(200, neon_coop_status($config, $clientId));
      return;
    }
    $status = neon_coop_status($config, $clientId);
    if ($status['enabled'] !== true) {
      neon_coop_json(403, ['ok' => false, 'enabled' => false, 'reason' => $status['reason'] ?? 'disabled']);
      return;
    }
    $pdo = neon_coop_pdo(neon_coop_database_path($config));
    $now = time();
    $code = strtoupper(substr((string) ($request['code'] ?? ''), 0, 8));
    if ($action === 'host') {
      $row = neon_coop_create_lobby($pdo, $clientId, $now);
      neon_coop_json(200, ['ok' => true, 'code' => $row['code'], 'role' => 'host']);
      return;
    }
    if ($action === 'join') {
      $result = neon_coop_join($pdo, $code, $clientId);
      if ($result['ok'] !== true) {
        neon_coop_json(200, ['ok' => false, 'error' => $result['error']]);
        return;
      }
      neon_coop_json(200, [
        'ok' => true,
        'code' => $result['row']['code'],
        'role' => 'guest',
        'hostId' => $result['row']['host_id'],
      ]);
      return;
    }
    if ($action === 'checkin') {
      $row = neon_coop_check_in($pdo, $code, $clientId, $now);
      neon_coop_json(200, ['ok' => $row !== null, 'code' => $code]);
      return;
    }
    if ($action === 'leave') {
      $result = neon_coop_leave($pdo, $code, $clientId);
      if ($result['ok'] !== true) {
        neon_coop_json(200, ['ok' => false, 'error' => 'notfound']);
        return;
      }
      neon_coop_json(200, ['ok' => true, 'deleted' => $result['deleted'] === true]);
      return;
    }
    if ($action === 'card') {
      $card = $request['card'] ?? null;
      if (!is_array($card)) {
        neon_coop_json(400, ['ok' => false, 'error' => 'card']);
        return;
      }
      $stored = neon_coop_put_card($pdo, $code, $clientId, $card, $now);
      if ($stored === null) {
        neon_coop_json(200, ['ok' => false, 'error' => 'notfound']);
        return;
      }
      neon_coop_json(200, ['ok' => true, 'rev' => $stored['rev']]);
      return;
    }
    if ($action === 'poll') {
      $since = (int) ($request['sinceRev'] ?? 0);
      $view = neon_coop_poll($pdo, $code, $clientId, $since, $now);
      if ($view === null) {
        neon_coop_json(200, ['ok' => false, 'error' => 'notfound']);
        return;
      }
      neon_coop_json(200, $view);
      return;
    }
    neon_coop_json(404, ['ok' => false, 'error' => 'unknown']);
  } catch (Throwable $error) {
    neon_coop_json(503, ['ok' => false, 'enabled' => false, 'reason' => 'unavailable']);
  }
}
