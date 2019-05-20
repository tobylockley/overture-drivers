root:

//new path
private static final String LED_GREEN_TURN_ON="echo 255 >  /sys/class/leds/led-front-green/brightness";
private static final String LED_GREEN_TURN_OFF="echo 0 >  /sys/class/leds/led-front-green/brightness";
private static final String LED_RED_TURN_ON="echo 255 >  /sys/class/leds/led-front-red/brightness";
private static final String LED_RED_TURN_OFF="echo 0 >  /sys/class/leds/led-front-red/brightness";

runRootCommand(LED_GREEN_TURN_ON);      
runRootCommand(LED_GREEN_TURN_OFF);     
runRootCommand(LED_RED_TURN_ON);         
runRootCommand(LED_RED_TURN_OFF);       

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

Need system permissions:android:sharedUserId="android.uid.system"

no-root:

private static final String LED_GREEN_TURN_ON="/sys/class/leds/led-front-green/brightness";
private static final String LED_GREEN_TURN_OFF="/sys/class/leds/led-front-green/brightness";
private static final String LED_RED_TURN_ON="/sys/class/leds/led-front-red/brightness";
private static final String LED_RED_TURN_OFF="/sys/class/leds/led-front-red/brightness";

writeValue(LED_GREEN_TURN_ON,"255");      
writeValue(LED_GREEN_TURN_OFF,"0");       
writeValue(LED_RED_TURN_ON,"255");     
writeValue(LED_RED_TURN_OFF,"0");        

private void writeValue(String path,String value){
		File file = new File(path);
        FileOutputStream os = null;
        try {
            os = new FileOutputStream(file, true);
            if (os != null)
                os.write((value).getBytes());
            os.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
	}

Need system permissions:android:sharedUserId="android.uid.system"