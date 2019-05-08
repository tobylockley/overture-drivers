package com.zd.demo.ledcontrol;

import android.app.Activity;
import android.content.Context;
import android.media.AudioManager;
import android.media.SoundPool;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.view.View.OnClickListener;
import android.widget.Button;

public class MainActivity extends Activity {

    private LedController ledController;
    private Handler mHandler;
    private Runnable mRunnable;
    private SoundPool mSoundPool;
    private boolean mIsLoaded = false;
    private int mSoundId = 0;
    private float mAudioVolume;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        ledController = new LedController();
        mHandler = new Handler();

        AudioManager aManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        float maxAudioVolume = aManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        float currentAudioVolume = aManager.getStreamVolume(AudioManager.STREAM_MUSIC);
        mAudioVolume = currentAudioVolume / maxAudioVolume;
        mSoundPool = new SoundPool(4, AudioManager.STREAM_MUSIC, 0);


        Button btnGreenOn = (Button) findViewById(R.id.green_on);
        btnGreenOn.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) {
                if (mRunnable != null) {
                    mHandler.removeCallbacks(mRunnable);
                    mRunnable = null;
                }
                if(isGreater23()){
                    ledController.turnOn(LedController.LED_BAR_GREEN_RK32);
                } else {
                    ledController.turnOn(LedController.LED_BAR_GREEN);
                }

                mSoundId = mSoundPool.load(MainActivity.this, R.raw.green_on, 1);
                audioPlay(mSoundId);
            }
        });

        Button btnGreenOff = (Button) findViewById(R.id.green_off);
        btnGreenOff.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) {
                if (mRunnable != null) {
                    mHandler.removeCallbacks(mRunnable);
                    mRunnable = null;
                }
                if(isGreater23()){
                    ledController.turnOff(LedController.LED_BAR_GREEN_RK32);
                } else {
                    ledController.turnOff(LedController.LED_BAR_GREEN);
                }

                mSoundId = mSoundPool.load(MainActivity.this, R.raw.green_off, 1);
                audioPlay(mSoundId);
            }
        });

        Button btnRedOn = (Button) findViewById(R.id.red_on);
        btnRedOn.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) {
                if (mRunnable != null) {
                    mHandler.removeCallbacks(mRunnable);
                    mRunnable = null;
                }
                if(isGreater23()){
                    ledController.turnOn(LedController.LED_BAR_RED_RK32);
                } else {
                    ledController.turnOn(LedController.LED_BAR_RED);
                }

                mSoundId = mSoundPool.load(MainActivity.this, R.raw.red_on, 1);
                audioPlay(mSoundId);
            }
        });

        Button btnRedOff = (Button) findViewById(R.id.red_off);
        btnRedOff.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) {
                if (mRunnable != null) {
                    mHandler.removeCallbacks(mRunnable);
                    mRunnable = null;
                }
                if(isGreater23()){
                    ledController.turnOff(LedController.LED_BAR_RED_RK32);
                } else {
                    ledController.turnOff(LedController.LED_BAR_RED);
                }

                mSoundId = mSoundPool.load(MainActivity.this, R.raw.red_off, 1);
                audioPlay(mSoundId);
            }
        });

        Button btnRedBlink = (Button) findViewById(R.id.red_blink);
        btnRedBlink.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) {
                if (mRunnable != null) {
                    mHandler.removeCallbacks(mRunnable);
                    mRunnable = null;
                }
                mRunnable = new Runnable() {
                    public void run() {
                        if(isGreater23()){
                            ledController.turnOn(LedController.LED_BAR_RED_RK32);
                            sleep(1);
                            ledController.turnOff(LedController.LED_BAR_RED_RK32);
                        } else {
                            ledController.turnOn(LedController.LED_BAR_RED);
                            sleep(1);
                            ledController.turnOff(LedController.LED_BAR_RED);
                        }
                        if (mHandler != null)
                            mHandler.postDelayed(mRunnable, 1);
                    }
                };
                mHandler.post(mRunnable);
            }
        });

        Button btnGreenBlink = (Button) findViewById(R.id.green_blink);
        btnGreenBlink.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) {
                if (mRunnable != null) {
                    mHandler.removeCallbacks(mRunnable);
                    mRunnable = null;
                }
                mRunnable = new Runnable() {
                    public void run() {
                        if(isGreater23()){
                            ledController.turnOn(LedController.LED_BAR_GREEN_RK32);
                            sleep(1);
                            ledController.turnOff(LedController.LED_BAR_GREEN_RK32);
                        } else {
                            ledController.turnOn(LedController.LED_BAR_GREEN);
                            sleep(1);
                            ledController.turnOff(LedController.LED_BAR_GREEN);
                        }

                        if (mHandler != null)
                            mHandler.postDelayed(mRunnable, 1);
                    }
                };
                mHandler.post(mRunnable);
            }
        });
    }

    private void sleep(long time) {
        try {
            Thread.sleep(time);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    private void audioPlay(int soundId){
        if (soundId != 0) {
            mIsLoaded = true;
            sleep(70);
            mSoundPool.play(soundId, mAudioVolume, mAudioVolume, 1, 0, 1.0f);
        }
    }

    private boolean isGreater23(){
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M;
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mIsLoaded)
            mSoundPool.unload(mSoundId);
        mSoundPool.release();
    }
}
