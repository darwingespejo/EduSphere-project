<?php
// Add these lines to app/config/routes.php (after `$router->get('/', ...)`).
// You do NOT need an OPTIONS route: LavaLust answers CORS preflights itself.

$router->post('/api/pico/chat', 'PicoChat::send');
