{{-- The hero: the amount is the biggest element in the email. --}}
@php($fresh = \App\Support\Brand::design() === 'fresh')
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 30px;">
<tr><td align="center" class="bg-soft hero-edge" style="background-color:{{ $fresh ? '#f0f8f6' : '#f4f7fb' }}; border-radius:{{ $fresh ? '20px' : '12px' }}; padding:32px 18px 28px; border:1px solid {{ $fresh ? '#cfe6df' : '#dbe3ec' }};">
    <div class="t-muted" style="font-size:14px; line-height:20px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:#5b6b7f;">{{ $label }}</div>
    <div class="hero-amount t-ink" style="font-size:44px; line-height:52px; font-weight:800; color:#14283d; margin-top:6px; letter-spacing:-0.5px;">{{ $amount }}</div>
    @if (! empty($note))<div class="t-muted" style="font-size:15px; line-height:22px; color:#5b6b7f; margin-top:4px;">{{ $note }}</div>@endif
</td></tr>
</table>
