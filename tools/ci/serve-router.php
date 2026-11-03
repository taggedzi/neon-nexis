<?php
declare(strict_types=1);

// Serve public files from PHP's selected document root. Only the co-op test
// endpoint comes from source when the public artifact is the document root.
$root = dirname(__DIR__, 2);
if (require $root . '/php/router.php') {
  return true;
}
$uri = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
if ($uri === '/php/coop.php') {
  require $root . '/php/coop.php';
  return true;
}
return false;
