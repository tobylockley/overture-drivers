package com.zd.demo.ledcontrol;

import android.os.Build;

import java.io.DataOutputStream;
import java.io.FileOutputStream;

public class LedController {

		/* RK-10P LED bar interface */
    public static final String LED_BAR_GREEN = "/sys/class/leds/led-front-green/brightness";
    public static final String LED_BAR_RED = "/sys/class/leds/led-front-red/brightness";
    
    /* RK-10P power LED interface */
    public static final String LED_POWER_GREEN = "/sys/class/leds/led-green/brightness";
    public static final String LED_POWER_RED = "/sys/class/leds/led-red/brightness";
    
    /* 10P-RM LED bar interface */
    public static final String LED_BAR_GREEN_RK32 = "/sys/class/leds/egpio_o2/brightness";
    public static final String LED_BAR_RED_RK32 = "/sys/class/leds/egpio_o1/brightness";
    
    /* 10P-RM power LED interface */
    public static final String LED_POWER_GREEN_RK32 = "/sys/class/leds/sys-led-green/brightness";
    public static final String LED_POWER_RED_RK32 = "/sys/class/leds/sys-led-red/brightness";
    
    private static final String TURN_ON = "echo 255 > ";
    private static final String TURN_OFF = "echo 0 > ";

    public LedController() {

    }

    public void turnOn(String led) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            writeBrightness(led, "255");
        } else {
            runRootCommand(TURN_ON + led);
        }
    }

    public void turnOff(String led) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            writeBrightness(led, "0");
        } else {
            runRootCommand(TURN_OFF + led);
        }
    }

    private static boolean runRootCommand(String command) {
        Process process = null;
        DataOutputStream os = null;
        try {
            process = Runtime.getRuntime().exec("su");
            os = new DataOutputStream(process.getOutputStream());
            os.writeBytes(command + "\n");
            os.writeBytes("exit\n");
            os.flush();
            process.waitFor();
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        } finally {
            try {
                if (os != null) {
                    os.close();
                }
                if (process != null) {
                    process.exitValue();
                }
            } catch (IllegalThreadStateException e) {
                process.destroy();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        return true;
    }

    private void writeBrightness(String path, String value) {
        try {
            FileOutputStream fos = new FileOutputStream(path, false);
            if (fos != null)
                fos.write(value.getBytes());
            fos.flush();
            fos.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

}
