<?php
declare(strict_types=1);

$uri = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
if ($uri === '') {
  $uri = '/';
}

$denied = str_contains($uri, '..')
  || preg_match('/\.sqlite($|-)/i', $uri) === 1
  || preg_match('#/(coop-config\.php|coop-cleanup\.php)$#', $uri) === 1
  || str_contains($uri, '/php/lib/')
  || str_contains($uri, '/php/data/');

if ($denied) {
  http_response_code(403);
  header('Content-Type: text/plain; charset=utf-8');
  header('Cache-Control: no-store');
  echo "Forbidden\n";
  return true;
}

return false;
