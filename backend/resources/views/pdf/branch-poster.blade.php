<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
  @page { margin: 12mm; }
  body { font-family: 'DejaVu Sans', sans-serif; color: #14283d; text-align: center; }
  .band { background: {{ $brand['primary'] }}; color: #fff; border-radius: 14px; padding: 10px 12px 12px; }
  .band h1 { margin: 0; font-size: 19pt; }
  .band p { margin: 4px 0 0; font-size: 10pt; }
  .logo { height: 44px; margin-bottom: 6px; }
  .qr { margin: 16px auto 8px; width: 80mm; height: 80mm; border: 3px solid {{ $brand['accent'] }}; border-radius: 12px; padding: 4mm; }
  .qr img { width: 100%; height: 100%; }
  .url { font-size: 11pt; font-weight: bold; color: {{ $brand['primary_dark'] }}; word-wrap: break-word; }
  .steps { text-align: left; margin: 12px 6mm 0; font-size: 10pt; line-height: 1.45; }
  .steps b { color: {{ $brand['accent_dark'] }}; }
  .small { font-size: 8pt; color: #5b6b7f; margin-top: 10px; }
</style></head>
<body>
  @if ($logo)<img class="logo" src="{{ $logo }}" alt="">@endif
  <div class="band">
    <h1>New here? Skip the paper form</h1>
    <p>{{ $brand['name'] }} · {{ $branch->name }}</p>
  </div>
  <div class="qr"><img src="{{ $qr }}" alt="QR code"></div>
  <div class="url">{{ $shortUrl }}</div>
  <div class="steps">
    <p><b>1.</b> Scan the code with your phone camera.</p>
    <p><b>2.</b> Choose <b>I'm new here</b> and fill in the form (you may scan your ID to fill it in; the photo stays on your phone), or <b>I have an account</b>.</p>
    <p><b>3.</b> To join today's queue, type the code shown at the front desk.</p>
  </div>
  <p class="small">Your details are used only for your dental care at the clinic (Data Privacy Act of 2012). No phone? Ask the front desk for the tablet.</p>
</body></html>
