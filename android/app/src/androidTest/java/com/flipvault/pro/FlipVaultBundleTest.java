package com.flipvault.pro;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Checks that the installed application contains everything needed for offline PDF reading. */
@RunWith(AndroidJUnit4.class)
public class FlipVaultBundleTest {
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();

    private String assetText(String path) throws Exception {
        try (InputStream input = context.getAssets().open(path);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] bytes = new byte[8192];
            int count;
            while ((count = input.read(bytes)) != -1) output.write(bytes, 0, count);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    @Test public void applicationIdentityIsCorrect() {
        assertEquals("com.flipvault.pro", context.getPackageName());
    }

    @Test public void webShellAndNativePluginsArePackaged() throws Exception {
        assertTrue(assetText("public/index.html").contains("FlipVault Pro"));
        assertTrue(assetText("capacitor.config.json").contains("com.flipvault.pro"));
        String plugins = assetText("capacitor.plugins.json");
        assertTrue(plugins.contains("Filesystem"));
        assertTrue(plugins.contains("Share"));
    }

    @Test public void pdfWorkerFontsAndCmapsAreAvailableOffline() throws Exception {
        boolean workerFound = false;
        for (String name : context.getAssets().list("public/assets")) {
            if (name.startsWith("pdf.worker") && name.endsWith(".mjs")) workerFound = true;
        }
        assertTrue(workerFound);
        assertTrue(context.getAssets().list("public/standard_fonts").length > 10);
        assertTrue(context.getAssets().list("public/cmaps").length > 100);
    }
}
