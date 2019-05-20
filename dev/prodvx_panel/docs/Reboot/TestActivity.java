package com.zd.testversion;

import android.content.Context;
import android.os.Build;
import android.os.Environment;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.util.Log;
import android.widget.TextView;
import android.widget.Toast;

import java.io.DataOutputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Arrays;

public class TestActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if(isRoot()){
            runRootCommand("reboot");
        }


    }
    public static boolean isRoot(){
        boolean res = false;
        runRootCommand("mount -t ext4 -o rw,remount /dev/block/system /system");
        runRootCommand("mkdir /system/111");
        File file = new File("/system/111");
        if(file.exists())
            res = true;
        runRootCommand("rm -r /system/111");
        return res;
    }
    public static boolean runRootCommand(String command)
    {
        Process process = null;
        DataOutputStream os = null;
        try
        {
            process = Runtime.getRuntime().exec("su");
            os = new DataOutputStream(process.getOutputStream());
            os.writeBytes(command + "\n");
            os.writeBytes("exit\n");
            os.flush();
            process.waitFor();
        } catch (Exception e){
            e.printStackTrace();
            return false;
        } finally{
            try
            {
                if (os != null)
                {
                    os.close();
                }
                process.destroy();
            } catch (Exception e){
                e.printStackTrace();
            }
        }
        return true;
    }

}
