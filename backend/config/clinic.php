<?php

return [
    // M1 employee invitations (PI-02: invitation by email). The validity period is an engineering default pending the
    // clinic's answer on invitation expiry; change it here or with EMPLOYEE_INVITATION_EXPIRE_HOURS.
    'invitation_expire_hours' => (int) env('EMPLOYEE_INVITATION_EXPIRE_HOURS', 72),
];
