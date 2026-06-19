package com.shoopefood.mobile.ui;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;

import com.shoopefood.mobile.R;
import com.shoopefood.mobile.databinding.FragmentDriverProfileBinding;
import com.shoopefood.mobile.model.Driver;
import com.shoopefood.mobile.model.DriverCompletedDelivery;
import com.shoopefood.mobile.model.DriverProfileData;
import com.shoopefood.mobile.model.DriverProfileResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.session.SessionManager;
import com.shoopefood.mobile.util.CurrencyUtils;
import com.shoopefood.mobile.viewmodel.DriverHomeViewModel;
import com.shoopefood.mobile.viewmodel.DriverHomeViewModelFactory;
import com.shoopefood.mobile.viewmodel.DriverUiState;

import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class DriverProfileFragment extends Fragment {

    private FragmentDriverProfileBinding binding;
    private ApiService apiService;
    private SessionManager sessionManager;
    private DriverHomeViewModel viewModel;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        binding = FragmentDriverProfileBinding.inflate(inflater, container, false);
        return binding.getRoot();
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        apiService = ApiClient.getService(requireContext());
        sessionManager = new SessionManager(requireContext());
        viewModel = new ViewModelProvider(
                requireActivity(),
                new DriverHomeViewModelFactory(requireActivity().getApplication())
        ).get(DriverHomeViewModel.class);

        binding.swipeRefreshDriverProfile.setColorSchemeResources(R.color.brand_green);
        binding.swipeRefreshDriverProfile.setOnRefreshListener(this::loadProfile);

        viewModel.getUiState().observe(getViewLifecycleOwner(), this::bindDriverFromState);
        loadProfile();
    }

    private void loadProfile() {
        int driverId = viewModel.getDriverId();
        if (driverId <= 0 && sessionManager.getUser() != null) {
            driverId = sessionManager.getUser().id;
        }
        if (driverId <= 0) {
            binding.swipeRefreshDriverProfile.setRefreshing(false);
            return;
        }

        if (!binding.swipeRefreshDriverProfile.isRefreshing()) {
            binding.progressDriverProfile.setVisibility(View.VISIBLE);
        }

        final int profileDriverId = driverId;
        apiService.getDriverProfile(profileDriverId).enqueue(new Callback<DriverProfileResponse>() {
            @Override
            public void onResponse(Call<DriverProfileResponse> call, Response<DriverProfileResponse> response) {
                binding.progressDriverProfile.setVisibility(View.GONE);
                binding.swipeRefreshDriverProfile.setRefreshing(false);

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(requireContext(), ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    bindDriverFromSession();
                    return;
                }

                bindProfile(response.body().data);
            }

            @Override
            public void onFailure(Call<DriverProfileResponse> call, Throwable t) {
                binding.progressDriverProfile.setVisibility(View.GONE);
                binding.swipeRefreshDriverProfile.setRefreshing(false);
                bindDriverFromSession();
                Toast.makeText(requireContext(), R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void bindDriverFromState(DriverUiState state) {
        if (state != null && state.driver != null && binding != null && !binding.swipeRefreshDriverProfile.isRefreshing()) {
            int completedCount = state.completedOrders != null ? state.completedOrders.size() : 0;
            bindDriverBasics(state.driver, completedCount);
        }
    }

    private void bindProfile(DriverProfileData profile) {
        if (profile.driver == null) {
            bindDriverFromSession();
            return;
        }
        bindDriverBasics(profile.driver, profile.completedCount);
        binding.textProfileDeliveries.setText(formatDeliveries(profile));
    }

    private void bindDriverFromSession() {
        DriverUiState state = viewModel.getUiState().getValue();
        if (state != null && state.driver != null) {
            bindDriverBasics(state.driver, 0);
        } else if (sessionManager.getUser() != null) {
            binding.textProfileName.setText(sessionManager.getUser().fullName);
            binding.textProfilePhone.setText(getString(R.string.driver_phone_label, safe(sessionManager.getUser().phone, "-")));
            binding.textProfileAvatar.setText(initial(sessionManager.getUser().fullName));
        }
        binding.textProfileDeliveries.setText(R.string.customer_driver_deliveries_empty);
        binding.textProfileCompletedCount.setText(getString(R.string.driver_profile_completed_count, 0));
    }

    private void bindDriverBasics(Driver driver, int completedCount) {
        binding.textProfileName.setText(safe(driver.fullName, "Tài xế"));
        binding.textProfilePhone.setText(getString(R.string.driver_phone_label, safe(driver.phone, "-")));
        binding.textProfileRating.setText(getString(
                R.string.driver_rating_label,
                String.format(Locale.US, "%.1f", driver.ratingAvg)
        ));
        binding.textProfileVehicle.setText(getString(
                R.string.driver_vehicle_detail,
                formatVehicleType(driver.vehicleType),
                safe(driver.licensePlate, "-")
        ));
        binding.textProfileCompletedCount.setText(getString(R.string.driver_profile_completed_count, completedCount));
        binding.textProfileAvatar.setText(initial(driver.fullName));
        bindOnlineChip(binding.textProfileOnline, driver.isOnline);
    }

    private CharSequence formatDeliveries(DriverProfileData profile) {
        if (profile.completedDeliveries == null || profile.completedDeliveries.isEmpty()) {
            return getString(R.string.customer_driver_deliveries_empty);
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < profile.completedDeliveries.size(); i++) {
            DriverCompletedDelivery delivery = profile.completedDeliveries.get(i);
            if (i > 0) {
                builder.append("\n");
            }
            builder.append(getString(
                    R.string.customer_driver_delivery_line,
                    safe(delivery.orderCode, "#" + delivery.id),
                    safe(delivery.restaurantName, "Quán"),
                    CurrencyUtils.formatVnd(delivery.totalAmount)
            ));
        }
        return builder.toString();
    }

    private void bindOnlineChip(TextView view, boolean isOnline) {
        view.setText(isOnline ? R.string.customer_driver_online : R.string.customer_driver_offline);
        view.setBackgroundResource(isOnline ? R.drawable.bg_driver_online : R.drawable.bg_driver_offline);
        view.setTextColor(ContextCompat.getColor(
                requireContext(),
                isOnline ? R.color.status_done_text : R.color.text_secondary
        ));
    }

    private String safe(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private String initial(String fullName) {
        if (fullName == null || fullName.trim().isEmpty()) {
            return "T";
        }
        return fullName.trim().substring(0, 1).toUpperCase(Locale.US);
    }

    private String formatVehicleType(String vehicleType) {
        if (vehicleType == null || vehicleType.trim().isEmpty()) {
            return "Chưa cập nhật";
        }
        String normalized = vehicleType.trim().toUpperCase(Locale.US);
        if ("MOTORBIKE".equals(normalized) || "MOTO".equals(normalized)) {
            return "Xe máy";
        }
        if ("CAR".equals(normalized)) {
            return "Ô tô";
        }
        if ("BICYCLE".equals(normalized)) {
            return "Xe đạp";
        }
        return vehicleType;
    }

    @Override
    public void onDestroyView() {
        binding = null;
        super.onDestroyView();
    }
}
