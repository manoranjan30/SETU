import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:signature/signature.dart';
import 'package:setu_mobile/features/auth/data/models/user_model.dart';
import 'package:setu_mobile/features/profile/presentation/bloc/profile_bloc.dart';

/// User profile page — editable profile fields + digital signature pad.
/// Must be wrapped in BlocProvider<ProfileBloc> by the caller.
class UserProfilePage extends StatefulWidget {
  const UserProfilePage({super.key});

  @override
  State<UserProfilePage> createState() => _UserProfilePageState();
}

class _UserProfilePageState extends State<UserProfilePage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _designationCtrl = TextEditingController();
  late final SignatureController _sigCtrl;
  bool _hasSignatureDrawn = false;

  @override
  void initState() {
    super.initState();
    _sigCtrl = SignatureController(
      penStrokeWidth: 2.5,
      penColor: Colors.black87,
      exportBackgroundColor: Colors.white,
    );
    _sigCtrl.addListener(_onSignatureChanged);
    context.read<ProfileBloc>().add(const LoadProfile());
  }

  void _onSignatureChanged() {
    final drawn = _sigCtrl.isNotEmpty;
    if (drawn != _hasSignatureDrawn) {
      setState(() => _hasSignatureDrawn = drawn);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _designationCtrl.dispose();
    _sigCtrl.removeListener(_onSignatureChanged);
    _sigCtrl.dispose();
    super.dispose();
  }

  void _populate(User user) {
    _nameCtrl.text = user.fullName;
    _emailCtrl.text = user.email;
    _phoneCtrl.text = user.phone ?? '';
    _designationCtrl.text = user.designation ?? '';
  }

  void _saveProfile() {
    if (_formKey.currentState?.validate() == false) return;
    context.read<ProfileBloc>().add(
      UpdateProfile(
        fullName: _nameCtrl.text.trim(),
        email: _emailCtrl.text.trim(),
        phone: _phoneCtrl.text.trim(),
        designation: _designationCtrl.text.trim(),
      ),
    );
  }

  Future<void> _saveSignature() async {
    final bytes = await _sigCtrl.toPngBytes();
    if (bytes == null || !mounted) return;
    context.read<ProfileBloc>().add(SaveSignature(bytes));
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ProfileBloc, ProfileState>(
      listener: (context, state) {
        if (state is ProfileLoaded) {
          _populate(state.user);
        }
        if (state is ProfileSaveSuccess) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.green.shade700,
            ),
          );
          // Reload to get confirmed data from server
          context.read<ProfileBloc>().add(const LoadProfile());
        }
        if (state is ProfileError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.red.shade700,
            ),
          );
          context.read<ProfileBloc>().add(const LoadProfile());
        }
      },
      builder: (context, state) {
        final isSaving = state is ProfileSaving;
        final isLoading = state is ProfileLoading || state is ProfileInitial;

        final user = switch (state) {
          final ProfileLoaded s => s.user,
          final ProfileSaving s => s.user,
          _ => null,
        };
        final sigBase64 = switch (state) {
          final ProfileLoaded s => s.signatureBase64,
          final ProfileSaving s => s.signatureBase64,
          _ => null,
        };

        return Scaffold(
          appBar: AppBar(
            title: const Text('My Profile'),
            actions: [
              if (isSaving)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
            ],
          ),
          body: isLoading
              ? const Center(child: CircularProgressIndicator())
              : user == null
              ? _ErrorView(
                  onRetry: () =>
                      context.read<ProfileBloc>().add(const LoadProfile()),
                )
              : _ProfileBody(
                  user: user,
                  sigBase64: sigBase64,
                  isSaving: isSaving,
                  formKey: _formKey,
                  nameCtrl: _nameCtrl,
                  emailCtrl: _emailCtrl,
                  phoneCtrl: _phoneCtrl,
                  designationCtrl: _designationCtrl,
                  sigCtrl: _sigCtrl,
                  hasSignatureDrawn: _hasSignatureDrawn,
                  onSaveProfile: _saveProfile,
                  onSaveSignature: _saveSignature,
                  onClearSignature: () {
                    _sigCtrl.clear();
                    setState(() => _hasSignatureDrawn = false);
                  },
                ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Profile body
// ---------------------------------------------------------------------------

class _ProfileBody extends StatelessWidget {
  final User user;
  final String? sigBase64;
  final bool isSaving;
  final GlobalKey<FormState> formKey;
  final TextEditingController nameCtrl;
  final TextEditingController emailCtrl;
  final TextEditingController phoneCtrl;
  final TextEditingController designationCtrl;
  final SignatureController sigCtrl;
  final bool hasSignatureDrawn;
  final VoidCallback onSaveProfile;
  final Future<void> Function() onSaveSignature;
  final VoidCallback onClearSignature;

  const _ProfileBody({
    required this.user,
    required this.sigBase64,
    required this.isSaving,
    required this.formKey,
    required this.nameCtrl,
    required this.emailCtrl,
    required this.phoneCtrl,
    required this.designationCtrl,
    required this.sigCtrl,
    required this.hasSignatureDrawn,
    required this.onSaveProfile,
    required this.onSaveSignature,
    required this.onClearSignature,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Avatar & identity ──────────────────────────────────────────
          _AvatarSection(user: user),
          const SizedBox(height: 28),

          // ── Profile details ────────────────────────────────────────────
          const _SectionHeader(
            icon: Icons.person_outline,
            title: 'Profile Details',
          ),
          const SizedBox(height: 14),
          Form(
            key: formKey,
            child: Column(
              children: [
                _ProfileField(
                  controller: nameCtrl,
                  label: 'Full Name',
                  icon: Icons.badge_outlined,
                  enabled: !isSaving,
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                _ProfileField(
                  controller: emailCtrl,
                  label: 'Email',
                  icon: Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress,
                  enabled: !isSaving,
                ),
                const SizedBox(height: 12),
                _ProfileField(
                  controller: phoneCtrl,
                  label: 'Phone',
                  icon: Icons.phone_outlined,
                  keyboardType: TextInputType.phone,
                  enabled: !isSaving,
                ),
                const SizedBox(height: 12),
                _ProfileField(
                  controller: designationCtrl,
                  label: 'Designation',
                  icon: Icons.work_outline,
                  enabled: !isSaving,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: isSaving ? null : onSaveProfile,
              icon: const Icon(Icons.save_outlined, size: 18),
              label: const Text('Save Profile'),
            ),
          ),

          const SizedBox(height: 32),

          // ── Digital Signature ──────────────────────────────────────────
          const _SectionHeader(
            icon: Icons.draw_outlined,
            title: 'Digital Signature',
          ),
          const SizedBox(height: 14),

          // Current signature preview
          if (sigBase64 != null) ...[
            Text(
              'Current signature:',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(
                  context,
                ).colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
            const SizedBox(height: 6),
            Container(
              height: 90,
              width: double.infinity,
              decoration: BoxDecoration(
                border: Border.all(color: Theme.of(context).dividerColor),
                borderRadius: BorderRadius.circular(8),
                color: Colors.white,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.memory(
                  base64Decode(sigBase64!),
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Draw below to update your signature:',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(
                  context,
                ).colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
            const SizedBox(height: 8),
          ] else ...[
            Text(
              'Draw your signature in the box below:',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(
                  context,
                ).colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
            const SizedBox(height: 10),
          ],

          // Signature pad
          Container(
            decoration: BoxDecoration(
              border: Border.all(
                color: Theme.of(
                  context,
                ).colorScheme.primary.withValues(alpha: 0.5),
                width: 1.5,
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Signature(
                controller: sigCtrl,
                height: 180,
                backgroundColor: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Sign with your finger or stylus',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.4),
            ),
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              OutlinedButton.icon(
                onPressed: isSaving ? null : onClearSignature,
                icon: const Icon(Icons.clear, size: 16),
                label: const Text('Clear'),
                style: OutlinedButton.styleFrom(
                  textStyle: const TextStyle(fontSize: 12),
                ),
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: (isSaving || !hasSignatureDrawn)
                    ? null
                    : onSaveSignature,
                icon: const Icon(Icons.save_outlined, size: 16),
                label: const Text('Save Signature'),
                style: FilledButton.styleFrom(
                  textStyle: const TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),

          const SizedBox(height: 40),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Avatar section
// ---------------------------------------------------------------------------

class _AvatarSection extends StatelessWidget {
  final User user;
  const _AvatarSection({required this.user});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        children: [
          CircleAvatar(
            radius: 44,
            backgroundColor: theme.colorScheme.primary,
            child: Text(
              user.initials,
              style: const TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            user.fullName.isNotEmpty ? user.fullName : user.username,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          if (user.designation?.isNotEmpty ?? false)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                user.designation!,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: user.roles
                .map(
                  (r) => Chip(
                    label: Text(r, style: const TextStyle(fontSize: 11)),
                    padding: EdgeInsets.zero,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    backgroundColor: theme.colorScheme.primaryContainer,
                    labelStyle: TextStyle(
                      color: theme.colorScheme.onPrimaryContainer,
                    ),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  const _SectionHeader({required this.icon, required this.title});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(icon, size: 18, color: theme.colorScheme.primary),
        const SizedBox(width: 8),
        Text(
          title,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.bold,
            color: theme.colorScheme.primary,
          ),
        ),
        const Expanded(child: Divider(indent: 8)),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Text field
// ---------------------------------------------------------------------------

class _ProfileField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType? keyboardType;
  final bool enabled;
  final String? Function(String?)? validator;

  const _ProfileField({
    required this.controller,
    required this.label,
    required this.icon,
    this.keyboardType,
    this.enabled = true,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      enabled: enabled,
      keyboardType: keyboardType,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 20),
        border: const OutlineInputBorder(),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 12,
        ),
        isDense: true,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Error view
// ---------------------------------------------------------------------------

class _ErrorView extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorView({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.error_outline,
            size: 64,
            color: Theme.of(context).colorScheme.error.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 12),
          const Text('Could not load profile'),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
