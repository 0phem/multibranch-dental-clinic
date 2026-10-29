<?php

namespace Tests\Feature\Auth;

use App\Models\{User, EmailVerificationOtp, AuditLog};
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** Independent processes/committed rows exercise the real PostgreSQL account lock. */
class ConcurrentVerificationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp(); // verifies the actual database BEFORE any rebuild
        $this->artisan('migrate:fresh')->assertSuccessful();
    }

    protected function tearDown(): void
    {
        $this->artisan('migrate:fresh')->assertSuccessful();
        parent::tearDown();
    }

    public function test_two_simultaneous_verifications_consume_the_code_once(): void
    {
        $user=User::factory()->unverified()->create();
        $otp=EmailVerificationOtp::create(['user_id'=>$user->id,'digest'=>Hash::make('123456'),'attempts'=>0,'sent_at'=>now(),'expires_at'=>now()->addMinutes(10)]);
        $start=microtime(true)+2;
        $children=[];
        for($i=0;$i<2;$i++) {
            $process=proc_open([PHP_BINARY,base_path('tests/Support/concurrent_verification.php'),$user->email,'123456',(string)$start],
                [1=>['pipe','w'],2=>['pipe','w']],$pipes,base_path(),array_merge(getenv(),[
                    'APP_ENV'=>'testing','DB_CONNECTION'=>'pgsql','DB_DATABASE'=>'dental_clinic_scratch','DB_URL'=>'',
                    'CACHE_STORE'=>'array','SESSION_DRIVER'=>'array','MAIL_MAILER'=>'array','BCRYPT_ROUNDS'=>'4',
                ]));
            $children[]=[$process,$pipes];
        }
        $statuses=[];
        foreach($children as [$process,$pipes]) {
            $out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);
            proc_close($process);
            $result=json_decode($out,true);
            $this->assertIsArray($result,"Verification child failed: $err");
            $statuses[]=$result['status'];
        }
        sort($statuses);
        $this->assertSame([200,422],$statuses);
        $this->assertNotNull($otp->fresh()->consumed_at);
        $this->assertSame(1,AuditLog::where('action','account.email_verified')->count());
    }
}
