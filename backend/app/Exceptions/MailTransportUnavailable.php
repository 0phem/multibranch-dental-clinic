<?php

namespace App\Exceptions;

/** Raised in production when account email (codes, security notices) would only be written to a local log. */
class MailTransportUnavailable extends \RuntimeException {}
