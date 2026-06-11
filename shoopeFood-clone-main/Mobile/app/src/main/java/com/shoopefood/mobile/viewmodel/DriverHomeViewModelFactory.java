package com.shoopefood.mobile.viewmodel;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.ViewModel;
import androidx.lifecycle.ViewModelProvider;

public class DriverHomeViewModelFactory implements ViewModelProvider.Factory {

    private final Application application;

    public DriverHomeViewModelFactory(Application application) {
        this.application = application;
    }

    @NonNull
    @Override
    @SuppressWarnings("unchecked")
    public <T extends ViewModel> T create(@NonNull Class<T> modelClass) {
        if (modelClass.isAssignableFrom(DriverHomeViewModel.class)) {
            return (T) new DriverHomeViewModel(application);
        }
        throw new IllegalArgumentException("Unknown ViewModel class");
    }
}
