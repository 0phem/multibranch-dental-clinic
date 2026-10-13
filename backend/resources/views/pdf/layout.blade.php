{{--
    Shared page for the Payment Receipt and Invoice PDFs (dompdf). Same brand as the emails: logo (data URI, no remote fetch),
    colours, clinic and branch details, a fixed page footer. Titles are "Payment Receipt" / "Invoice"; never "Official".
--}}
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{ $title }}</title>
<style>
    @page { margin: 34px 40px 70px; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 10.5px; color: #354960; line-height: 1.45; }
    .band { background-color: {{ $brand['primary'] }}; color: #ffffff; padding: 16px 20px; border-radius: 8px; }
    .band td { color: #ffffff; vertical-align: middle; }
    .chip { background-color: #ffffff; border-radius: 8px; padding: 4px; width: 44px; height: 44px; }
    .accent { height: 4px; background-color: {{ $brand['accent'] }}; margin: 0 0 18px; }
    .name { font-size: 16px; font-weight: bold; }
    .sub { font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: #dcecfb; }
    .doc-title { font-size: 20px; font-weight: bold; color: #182b41; margin: 0; }
    .muted { color: #5b6b7f; }
    .ink { color: #182b41; }
    .badge { display: inline-block; font-size: 9px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; padding: 4px 10px; border-radius: 10px; }
    .paid { background-color: #e3f6ec; color: #146c43; }
    .due { background-color: #fff1d6; color: #8a5300; }
    .hero { background-color: #f4f8fc; border: 1px solid #dde6f0; border-radius: 8px; padding: 12px 16px; text-align: right; }
    .hero .label { font-size: 8.5px; letter-spacing: 1.5px; text-transform: uppercase; color: #5b6b7f; font-weight: bold; }
    .hero .amount { font-size: 22px; font-weight: bold; color: #182b41; }
    table.grid { width: 100%; border-collapse: collapse; }
    table.kv td { padding: 5px 0; vertical-align: top; }
    table.kv td.k { color: #5b6b7f; width: 38%; }
    table.kv td.v { color: #182b41; font-weight: bold; }
    .mono { font-family: 'DejaVu Sans Mono', monospace; font-weight: normal !important; font-size: 9.5px; }
    .section { font-size: 8.5px; letter-spacing: 1.5px; text-transform: uppercase; color: #5b6b7f; font-weight: bold; margin: 18px 0 6px; }
    table.items th { background-color: #f1f6fb; color: #5b6b7f; font-size: 8.5px; letter-spacing: 1px; text-transform: uppercase; text-align: left; padding: 7px 10px; border-bottom: 1px solid #dde6f0; }
    table.items td { padding: 8px 10px; border-bottom: 1px solid #eef3f8; color: #182b41; }
    table.items .r { text-align: right; white-space: nowrap; }
    table.items .c { text-align: center; }
    table.items tr.sum td { border-bottom: none; padding: 4px 10px; color: #5b6b7f; }
    table.items tr.total td { border-top: 2px solid {{ $brand['primary'] }}; border-bottom: none; font-size: 12px; font-weight: bold; color: #182b41; padding-top: 8px; }
    .note { border-left: 3px solid #1a7f52; background-color: #e9f8f1; padding: 8px 12px; border-radius: 4px; margin-top: 14px; color: #354960; }
    .note.warn { border-left-color: #c77700; background-color: #fff7e6; }
    .box { border: 1px solid #dde6f0; border-radius: 8px; padding: 10px 14px; }
    footer { position: fixed; bottom: -48px; left: 0; right: 0; font-size: 8.5px; color: #8796a8; border-top: 1px solid #dde6f0; padding-top: 6px; }
</style>
</head>
<body>
<footer>
    <table class="grid"><tr>
        <td>{{ $brand['name'] }}@if ($brand['branch_name']) &middot; {{ $brand['branch_name'] }}@endif @if ($brand['branch_address'] ?: $brand['address']) &middot; {{ $brand['branch_address'] ?: $brand['address'] }}@endif</td>
        <td style="text-align:right;">{{ $brand['branch_phone'] ?: $brand['phone'] }}@if ($brand['email']) &middot; {{ $brand['email'] }}@endif</td>
    </tr></table>
    <div>{{ $title }} {{ $docNumber }} &middot; Generated {{ \App\Support\ClinicClock::now()->format('F j, Y g:i A') }} (Philippine time)</div>
</footer>

<div class="band">
    <table class="grid"><tr>
        @if ($logo)<td style="width:58px;"><div class="chip"><img src="{{ $logo }}" width="44" height="44" alt="{{ $brand['name'] }} logo"></div></td>@endif
        <td><div class="name">{{ $brand['name_line'] }}</div>@if ($brand['subtitle'])<div class="sub">{{ $brand['subtitle'] }}</div>@endif</td>
        <td style="text-align:right; font-size:9px; color:#dcecfb;">
            @if ($brand['branch_name'])<div style="color:#ffffff; font-weight:bold;">{{ $brand['branch_name'] }}</div>@endif
            @if ($brand['branch_address'] ?: $brand['address'])<div>{{ $brand['branch_address'] ?: $brand['address'] }}</div>@endif
            <div>{{ $brand['branch_phone'] ?: $brand['phone'] }}</div>
            @if ($brand['email'])<div>{{ $brand['email'] }}</div>@endif
        </td>
    </tr></table>
</div>
<div class="accent"></div>

@yield('content')

@if (! empty($bir))
    <div class="section">Business registration</div>
    <div class="box"><table class="grid kv">
        @foreach ($bir as $label => $value)<tr><td class="k">{{ $label }}</td><td class="v">{{ $value }}</td></tr>@endforeach
    </table></div>
@endif
</body>
</html>
