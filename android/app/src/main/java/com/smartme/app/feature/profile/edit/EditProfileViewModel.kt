package com.smartme.app.feature.profile.edit

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.ProfileDto
import com.smartme.app.data.account.AccountRepository
import com.smartme.app.data.account.ProfileField
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class EditProfileUiState(
    val loading: Boolean = true,
    val loadError: String? = null,
    val form: EditProfileForm = EditProfileForm(),
    val errors: Map<ProfileField, Int> = emptyMap(),
    val saving: Boolean = false,
    val saveError: String? = null,
    val saved: Boolean = false,
)

@HiltViewModel
class EditProfileViewModel @Inject constructor(
    private val repository: AccountRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(EditProfileUiState())
    val state: StateFlow<EditProfileUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, loadError = null)
            when (val result = repository.profile()) {
                is ApiResult.Success -> _state.value = EditProfileUiState(
                    loading = false,
                    form = result.data.toForm(),
                )

                is ApiResult.Failure -> _state.value = _state.value.copy(
                    loading = false,
                    loadError = result.error.message,
                )
            }
        }
    }

    fun updateForm(transform: (EditProfileForm) -> EditProfileForm) {
        _state.value = _state.value.copy(
            form = transform(_state.value.form),
            errors = emptyMap(),
            saveError = null,
            saved = false,
        )
    }

    fun save() {
        val current = _state.value
        if (current.saving) return
        val errors = validateProfileForm(current.form)
        if (errors.isNotEmpty()) {
            _state.value = current.copy(errors = errors)
            return
        }

        viewModelScope.launch {
            _state.value = current.copy(saving = true, saveError = null, errors = emptyMap())
            when (val result = repository.updateProfile(current.form.toUpdate())) {
                is ApiResult.Success -> _state.value = _state.value.copy(
                    saving = false,
                    saved = true,
                    form = result.data.toForm(),
                )

                is ApiResult.Failure -> _state.value = _state.value.copy(
                    saving = false,
                    saveError = result.error.message,
                )
            }
        }
    }
}

internal fun ProfileDto.toForm(): EditProfileForm = EditProfileForm(
    name = name.orEmpty(),
    headline = profile.headline.orEmpty(),
    occupation = profile.occupation.orEmpty(),
    city = profile.city.orEmpty(),
    bio = profile.bio.orEmpty(),
    dateOfBirth = profile.dateOfBirth.orEmpty(),
    avatarUrl = avatarUrl.orEmpty(),
)
