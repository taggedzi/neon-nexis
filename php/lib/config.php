<?php
declare(strict_types=1);

const NEON_COOP_DEFAULT_TTL = 7200;
const NEON_COOP_STALE_SECONDS = 600;
const NEON_COOP_MAX_AGE_SECONDS = 86400;

function neon_coop_config_path(): string
{
  $override = getenv('NEON_COOP_CONFIG');
  if (is_string($override) && $override !== '') {
    return $override;
  }
  $real = dirname(__DIR__) . '/coop-config.php';
  if (is_file($real)) {
    return $real;
  }
  return dirname(__DIR__) . '/coop-config.sample.php';
}

function neon_coop_load_config(): array
{
  $path = neon_coop_config_path();
  if (!is_file($path)) {
    throw new RuntimeException('Co-op config is missing');
  }
  $config = include $path;
  if (!is_array($config)) {
    throw new RuntimeException('Co-op config must return an array');
  }
  return $config;
}

function neon_coop_ttl(array $config): int
{
  $ttl = $config['credentialTtlSeconds'] ?? NEON_COOP_DEFAULT_TTL;
  if (!is_int($ttl) && !(is_string($ttl) && ctype_digit($ttl))) {
    return NEON_COOP_DEFAULT_TTL;
  }
  $ttl = (int) $ttl;
  if ($ttl < 60 || $ttl > 86400) {
    return NEON_COOP_DEFAULT_TTL;
  }
  return $ttl;
}

function neon_coop_database_path(array $config): string
{
  $override = getenv('NEON_COOP_DB');
  if (is_string($override) && $override !== '') {
    return $override;
  }
  if (isset($config['database']) && is_string($config['database']) && $config['database'] !== '') {
    return $config['database'];
  }
  return dirname(__DIR__, 3) . '/neon-nexis-coop-data/coop.sqlite';
}

function neon_coop_client_id(mixed $value): string
{
  $id = is_string($value) ? $value : '';
  $id = preg_replace('/[^A-Za-z0-9_-]/', '', $id) ?? '';
  if ($id === '') {
    return 'anon';
  }
  return substr($id, 0, 64);
}

function neon_coop_profile(mixed $value): array
{
  $profile = is_array($value) ? $value : [];
  return [
    'name' => substr((string) ($profile['name'] ?? 'PLAYER'), 0, 20),
    'shipType' => substr((string) ($profile['shipType'] ?? 'dart'), 0, 16),
    'shipColor' => substr((string) ($profile['shipColor'] ?? '#00f0ff'), 0, 16),
  ];
}
