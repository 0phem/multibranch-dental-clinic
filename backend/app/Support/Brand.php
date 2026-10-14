<?php

namespace App\Support;

use App\Models\Branch;

/**
 * White-label branding for every email and PDF (decision 12). Templates never hard-code the clinic name, colours, logo or contact
 * details: they read them here, from config('clinic.brand') (backend/.env), and the branch's own name, address and phone.
 */
final class Brand
{
    private const HEX = '/^#[0-9a-fA-F]{6}$/';

    private const DEFAULT_COLOURS = ['primary' => '#1865ac', 'primary_dark' => '#124b80', 'accent' => '#0c9b8e'];

    /** Plain words for the stored payment method ("PayMongo (CARD)" -> "Card"). Unknown values are shown as stored. */
    private const METHOD_WORDS = ['CARD' => 'Card', 'GCASH' => 'GCash', 'MAYA' => 'Maya', 'GRABPAY' => 'GrabPay', 'ONLINE BANKING' => 'Online banking',
        'QR PH' => 'QR Ph', 'SHOPEEPAY' => 'ShopeePay', 'BILLEASE' => 'BillEase', 'ONLINE' => 'Online payment'];

    public static function name(): string
    {
        return self::text('name') ?? (config('mail.from.name') ?: (string) config('app.name'));
    }

    /** @return array<string, mixed> everything a template needs; $branch adds that branch's contact details and BIR fields. */
    public static function forEmail(?Branch $branch = null): array
    {
        $colours = [];
        foreach (self::DEFAULT_COLOURS as $key => $default) {
            $value = (string) config("clinic.brand.$key");
            $colours[$key] = preg_match(self::HEX, $value) ? strtolower($value) : $default;
        }

        return $colours + [
            'name' => self::name(),
            'name_line' => self::text('name_line') ?? self::name(),
            'subtitle' => self::text('subtitle'),
            'address' => self::text('address'),
            'phone' => self::text('phone'),
            'email' => self::text('email'),
            'branch_name' => $branch?->name,
            'branch_address' => $branch?->address,
            'branch_phone' => $branch?->phone,
            'bir' => self::bir($branch),
            'portal_url' => rtrim((string) config('app.frontend_url'), '/').'/#sign-in',
        ];
    }

    /** The patient portal opened on one invoice (after sign-in when needed): the target of the receipt and invoice buttons. */
    public static function invoiceUrl(string $invoicePublicId): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/?invoice='.rawurlencode($invoicePublicId).'#sign-in';
    }

    /** Absolute path of the logo PNG, or null when the configured file is missing (the header then shows the name only). */
    public static function logoPath(): ?string
    {
        $path = (string) config('clinic.brand.logo');

        return $path !== '' && is_file($path) && is_readable($path) ? $path : null;
    }

    /** The logo as a data: URI, for PDFs and the /dev/mail preview (a real email embeds it as a CID attachment instead). */
    public static function logoDataUri(): ?string
    {
        $path = self::logoPath();

        return $path ? 'data:image/png;base64,'.base64_encode((string) file_get_contents($path)) : null;
    }

    public static function paymentMethod(?string $stored): string
    {
        $stored = trim((string) $stored);
        if (preg_match('/^PayMongo \((.+)\)$/', $stored, $m)) return self::METHOD_WORDS[strtoupper($m[1])] ?? ucfirst(strtolower($m[1]));

        return $stored !== '' ? $stored : 'Not recorded';
    }

    public static function money(string|float|int|null $amount): string
    {
        return '₱'.number_format((float) $amount, 2);
    }

    /** Payment and issue times are shown in clinic time, 12-hour format. */
    public static function dateTime(?\DateTimeInterface $instant): ?string
    {
        return $instant ? ClinicClock::local($instant)->format('F j, Y \a\t g:i A') : null;
    }

    public static function date(?\DateTimeInterface $instant): ?string
    {
        return $instant ? ClinicClock::local($instant)->format('F j, Y') : null;
    }

    /**
     * Optional BIR registration details for a branch (decision 8). Only the fields the clinic filled in are returned; an empty
     * array means nothing BIR-related is printed at all.
     *
     * @return array<string, string>
     */
    public static function bir(?Branch $branch): array
    {
        if (! $branch) return [];
        $vat = match ($branch->bir_vat_status ?? null) { 'vat' => 'VAT-registered', 'non_vat' => 'Non-VAT registered', default => null };
        $fields = ['Registered name' => $branch->bir_registered_name ?? null, 'TIN' => $branch->bir_tin ?? null,
            'Registered address' => $branch->bir_registered_address ?? null, 'VAT status' => $vat, 'Permit numbers' => $branch->bir_permit_numbers ?? null];

        return array_filter(array_map(fn ($v) => is_string($v) ? trim($v) : $v, $fields), fn ($v) => is_string($v) && $v !== '');
    }

    private static function text(string $key): ?string
    {
        $value = trim((string) config("clinic.brand.$key"));

        return $value !== '' ? $value : null;
    }
}
