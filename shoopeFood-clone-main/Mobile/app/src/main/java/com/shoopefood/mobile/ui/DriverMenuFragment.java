package com.shoopefood.mobile.ui;

import android.content.Context;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.shoopefood.mobile.databinding.FragmentDriverMenuBinding;

public class DriverMenuFragment extends Fragment {

    private FragmentDriverMenuBinding binding;
    private DriverHomeHost host;

    @Override
    public void onAttach(@NonNull Context context) {
        super.onAttach(context);
        if (!(context instanceof DriverHomeHost)) {
            throw new IllegalStateException("Host must implement DriverHomeHost");
        }
        host = (DriverHomeHost) context;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        binding = FragmentDriverMenuBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        binding.buttonMenuReloadOrders.setOnClickListener(v -> host.reloadDeliveryFeed());
        binding.buttonMenuGoDelivery.setOnClickListener(v -> host.showDeliveryTab());
        binding.buttonMenuLogout.setOnClickListener(v -> host.logoutDriver());
    }

    @Override
    public void onDestroyView() {
        binding = null;
        super.onDestroyView();
    }
}
