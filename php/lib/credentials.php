<?php
declare(strict_types=1);

function neon_coop_public_ice(array $entry): ?array
{
  $urls = $entry['urls'] ?? ($entry['url'] ?? null);
  if (is_string($urls)) {
    $urls = trim($urls);
    if ($urls === '') {
      return null;
    }
  } elseif (is_array($urls)) {
    $clean = [];
    foreach ($urls as $url) {
      if (!is_string($url) || trim($url) === '') {
        continue;
      }
      $clean[] = trim($url);
    }
    if ($clean === []) {
      return null;
    }
    $urls = $clean;
  } else {
    return null;
  }
  $out = ['urls' => $urls];
  if (isset($entry['username']) && is_string($entry['username']) && $entry['username'] !== '') {
    $out['username'] = $entry['username'];
  }
  if (isset($entry['credential']) && is_string($entry['credential']) && $entry['credential'] !== '') {
    $out['credential'] = $entry['credential'];
  }
  return $out;
}

function neon_coop_mint_turn(array $entry, string $clientId, int $ttl): array
{
  $secret = $entry['secret'] ?? '';
  if (!is_string($secret) || $secret === '') {
    throw new RuntimeException('TURN secret is missing');
  }
  $public = neon_coop_public_ice($entry);
  if ($public === null) {
    throw new RuntimeException('TURN urls are missing');
  }
  $username = (time() + $ttl) . ':' . $clientId;
  $public['username'] = $username;
  $public['credential'] = base64_encode(hash_hmac('sha1', $username, $secret, true));
  return $public;
}

function neon_coop_provider_request(array $entry, int $ttl): array
{
  $provider = (string) ($entry['provider'] ?? '');
  $override = isset($entry['tokenUrl']) && is_string($entry['tokenUrl']) ? $entry['tokenUrl'] : '';
  if ($provider === 'twilio') {
    $sid = (string) ($entry['accountSid'] ?? '');
    $token = (string) ($entry['authToken'] ?? '');
    if ($sid === '' || $token === '') {
      throw new RuntimeException('Twilio credentials are missing');
    }
    return [
      'method' => 'POST',
      'url' => $override !== '' ? $override : 'https://api.twilio.com/2010-04-01/Accounts/' . rawurlencode($sid) . '/Tokens.json',
      'headers' => ['Authorization: Basic ' . base64_encode($sid . ':' . $token)],
      'body' => '',
    ];
  }
  if ($provider === 'cloudflare') {
    $keyId = (string) ($entry['keyId'] ?? '');
    $apiToken = (string) ($entry['apiToken'] ?? '');
    if ($keyId === '' || $apiToken === '') {
      throw new RuntimeException('Cloudflare credentials are missing');
    }
    return [
      'method' => 'POST',
      'url' => $override !== '' ? $override : 'https://rtc.live.cloudflare.com/v1/turn/keys/' . rawurlencode($keyId) . '/credentials/generate',
      'headers' => [
        'Authorization: Bearer ' . $apiToken,
        'Content-Type: application/json',
      ],
      'body' => json_encode(['ttl' => $ttl], JSON_THROW_ON_ERROR),
    ];
  }
  if ($provider === 'metered') {
    $apiKey = (string) ($entry['apiKey'] ?? '');
    $appName = (string) ($entry['appName'] ?? '');
    if ($apiKey === '' || $appName === '') {
      throw new RuntimeException('Metered credentials are missing');
    }
    $default = 'https://' . rawurlencode($appName) . '.metered.live/api/v1/turn/credentials?apiKey=' . rawurlencode($apiKey);
    return [
      'method' => 'GET',
      'url' => $override !== '' ? $override : $default,
      'headers' => ['Authorization: Bearer ' . $apiKey],
      'body' => '',
    ];
  }
  if ($provider === 'xirsys') {
    $ident = (string) ($entry['ident'] ?? '');
    $secret = (string) ($entry['secret'] ?? '');
    $channel = (string) ($entry['channel'] ?? '');
    if ($ident === '' || $secret === '' || $channel === '') {
      throw new RuntimeException('Xirsys credentials are missing');
    }
    return [
      'method' => 'PUT',
      'url' => $override !== '' ? $override : 'https://global.xirsys.net/_turn/' . rawurlencode($channel),
      'headers' => [
        'Authorization: Basic ' . base64_encode($ident . ':' . $secret),
        'Content-Type: application/json',
      ],
      'body' => json_encode(['format' => 'urls'], JSON_THROW_ON_ERROR),
    ];
  }
  throw new RuntimeException('Unknown ICE provider');
}

function neon_coop_http_json(string $method, string $url, array $headers, string $body): array
{
  if (!function_exists('curl_init')) {
    throw new RuntimeException('HTTP client is unavailable');
  }
  $ch = curl_init($url);
  if ($ch === false) {
    throw new RuntimeException('HTTP client is unavailable');
  }
  $options = [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 3,
    CURLOPT_CONNECTTIMEOUT => 2,
    CURLOPT_HTTPHEADER => $headers,
  ];
  if ($method === 'GET') {
    $options[CURLOPT_HTTPGET] = true;
  } elseif ($body !== '') {
    $options[CURLOPT_POSTFIELDS] = $body;
  }
  curl_setopt_array($ch, $options);
  $raw = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);
  if (!is_string($raw) || $code < 200 || $code >= 300) {
    throw new RuntimeException('Token endpoint failed');
  }
  $decoded = json_decode($raw, true);
  if (!is_array($decoded)) {
    throw new RuntimeException('Token endpoint returned invalid JSON');
  }
  return $decoded;
}

function neon_coop_provider_ice(array $entry, int $ttl): array
{
  $request = neon_coop_provider_request($entry, $ttl);
  $payload = neon_coop_http_json($request['method'], $request['url'], $request['headers'], $request['body']);
  $provider = (string) $entry['provider'];
  if ($provider === 'twilio') {
    $list = $payload['ice_servers'] ?? $payload['iceServers'] ?? null;
  } elseif ($provider === 'xirsys') {
    $list = $payload['v']['iceServers'] ?? null;
  } elseif ($provider === 'metered' && array_is_list($payload)) {
    $list = $payload;
  } else {
    $list = $payload['iceServers'] ?? null;
  }
  if (is_array($list) && !array_is_list($list)) {
    $list = [$list];
  }
  if (!is_array($list)) {
    throw new RuntimeException('Token endpoint omitted ice servers');
  }
  $servers = [];
  foreach ($list as $item) {
    if (!is_array($item)) {
      continue;
    }
    $public = neon_coop_public_ice($item);
    if ($public !== null) {
      $servers[] = $public;
    }
  }
  if ($servers === []) {
    throw new RuntimeException('Token endpoint omitted ice servers');
  }
  return $servers;
}

function neon_coop_ice_servers(array $config, string $clientId): array
{
  $entries = $config['iceServers'] ?? [];
  if (!is_array($entries) || $entries === []) {
    return [];
  }
  $ttl = neon_coop_ttl($config);
  $servers = [];
  foreach ($entries as $entry) {
    if (!is_array($entry)) {
      throw new RuntimeException('ICE entry is invalid');
    }
    if (isset($entry['provider'])) {
      foreach (neon_coop_provider_ice($entry, $ttl) as $server) {
        $servers[] = $server;
      }
      continue;
    }
    $secret = $entry['secret'] ?? null;
    if (is_string($secret) && $secret !== '') {
      $servers[] = neon_coop_mint_turn($entry, $clientId, $ttl);
      continue;
    }
    $public = neon_coop_public_ice($entry);
    if ($public === null) {
      throw new RuntimeException('ICE entry is invalid');
    }
    $servers[] = $public;
  }
  return $servers;
}

function neon_coop_enabled(array $config, array $servers): bool
{
  return ($config['enabled'] ?? false) === true && $servers !== [];
}
