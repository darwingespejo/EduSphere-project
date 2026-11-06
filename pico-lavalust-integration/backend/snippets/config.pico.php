<?php
// Only needed when the React app is served from a DIFFERENT origin than LavaLust
// (for example https://app.example.com calling https://api.example.com).
// With the Vite dev proxy, or when both live on one domain, skip this file.
//
// In app/config/config.php, find the $config['security_headers'] array and set:

$config['security_headers']['cors']['allowed_origins'] = array_values(array_filter(array_map('trim',
    explode(',', getenv('PICO_ALLOWED_ORIGINS') ?: '')
)));
// Optional: only if the frontend sends cookies (credentials: 'include').
// Then allowed_origins must list exact origins, never '*'.
// $config['security_headers']['cors']['credentials'] = true;

// If the frontend sends a custom header such as X-Requested-With or a CSRF token,
// add it to $config['security_headers']['cors']['headers'].
//
// (Put that block AFTER the big $config['security_headers'] = [...]; assignment so it is not overwritten.)
