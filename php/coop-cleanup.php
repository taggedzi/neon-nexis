<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
  http_response_code(404);
  header('Content-Type: text/plain; charset=utf-8');
  header('Cache-Control: no-store');
  echo "Not found\n";
  exit;
}

require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/store.php';

$config = neon_coop_load_config();
$pdo = neon_coop_pdo(neon_coop_database_path($config));
neon_coop_delete_aged($pdo, time());
echo "Co-op cleanup finished\n";
