package com.shoopefood.mobile.util;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.util.TypedValue;

import androidx.core.content.ContextCompat;

public final class MapMarkerUtils {

    private MapMarkerUtils() {
    }

    public static Drawable toMarkerIcon(Context context, int drawableRes, float sizeDp) {
        Drawable drawable = ContextCompat.getDrawable(context, drawableRes);
        if (drawable == null) {
            return null;
        }

        int sizePx = (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                sizeDp,
                context.getResources().getDisplayMetrics()
        );
        Bitmap bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, sizePx, sizePx);
        drawable.draw(canvas);
        return new BitmapDrawable(context.getResources(), bitmap);
    }
}
