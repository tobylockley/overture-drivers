import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;

import java.util.Calendar;


public class ScheduleActivity extends AppCompatActivity {
    public static final String ACTION_SCHEDULE_POWER_ON = "com.action.power.on";
    public static final String ACTION_SCHEDULE_POWER_OFF = "com.action.power.off";
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        sendUpdateBroadcast(this, 1000,
                ACTION_SCHEDULE_POWER_ON);//SCHEDULE_POWER_ON
        sendUpdateBroadcast(this, 1000,
                ACTION_SCHEDULE_POWER_OFF);//SCHEDULE_POWER_OFF

    }
    public static void sendUpdateBroadcast(Context context, int time, String action) {
        long targetTime = getTime(time / 100, time % 100);
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(action);
        intent.putExtra("targetTime", targetTime);
        PendingIntent sender = PendingIntent.getBroadcast(context, 0, intent,
                PendingIntent.FLAG_CANCEL_CURRENT);
        if (action.equals(ACTION_SCHEDULE_POWER_ON)) {
            am.set(AlarmManager.RTC_WAKEUP, getRepeatTime(), sender);
        } else if (action.equals(ACTION_SCHEDULE_POWER_OFF)) {

            am.set(AlarmManager.RTC, getRepeatTime(), sender);
        }
    }

    public static long getTime(int hour, int minute) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(System.currentTimeMillis());
        int nowHour = c.get(Calendar.HOUR_OF_DAY);
        int nowMinute = c.get(Calendar.MINUTE);
        if (hour < nowHour || hour == nowHour && minute <= nowMinute)
            c.add(Calendar.DAY_OF_YEAR, 1);
        c.set(Calendar.HOUR_OF_DAY, hour);
        c.set(Calendar.MINUTE, minute);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    public static long getRepeatTime() {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(System.currentTimeMillis());
        c.add(Calendar.SECOND, 3);
        return c.getTimeInMillis();
    }

}
