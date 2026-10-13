{{-- One-time code: large, spaced, monospace digits in two groups of three so it is easy to read and type. --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
<tr><td align="center" style="background-color:#eaf2fb; border:1px solid #c9dcf0; border-radius:10px; padding:20px 12px;">
    <div style="font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:16px; letter-spacing:1px; text-transform:uppercase; color:#5b6b7f; margin-bottom:8px;">Your code</div>
    <div class="code" style="font-family:'Courier New', Courier, monospace; font-size:36px; line-height:44px; font-weight:700; letter-spacing:10px; color:#124b80;">{{ substr($code, 0, 3) }}&nbsp;{{ substr($code, 3) }}</div>
    <div style="font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:18px; color:#5b6b7f; margin-top:8px;">Expires in {{ $minutes }} minutes &middot; works once</div>
</td></tr>
</table>
