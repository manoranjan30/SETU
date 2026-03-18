import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:signature/signature.dart';

import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';
import 'package:setu_mobile/injection_container.dart';

/// Modal bottom sheet that collects a digital signature.
///
/// Shows two tabs:
///   • Use Saved — displays the signature stored in the user's profile
///   • Draw — lets the user sign with a finger
///
/// [onSubmit] is called with (signatureData, signedBy, comments) when the user
/// confirms. Pass [title] and [subtitle] to customise the header text.
///
/// Use [SignatureApprovalSheet.show] for the legacy AdvanceWorkflowStep flow.
/// Use [SignatureApprovalSheet.showForStage] for the stage-level approval flow.
class SignatureApprovalSheet extends StatefulWidget {
  final String title;
  final String? subtitle;
  final void Function(String signatureData, String signedBy, String? comments)
      onSubmit;

  const SignatureApprovalSheet({
    super.key,
    required this.title,
    this.subtitle,
    required this.onSubmit,
  });

  /// Show the sheet for advancing the legacy workflow step.
  /// Returns true if submitted, false/null otherwise.
  static Future<bool?> show(BuildContext context) {
    final bloc = context.read<QualityApprovalBloc>();
    final authBloc = context.read<AuthBloc>();
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => MultiBlocProvider(
        providers: [
          BlocProvider.value(value: bloc),
          BlocProvider.value(value: authBloc),
        ],
        child: Builder(
          builder: (ctx) => SignatureApprovalSheet(
            title: 'Approve Workflow Step',
            subtitle:
                'Your digital signature is required to advance the approval.',
            onSubmit: (signatureData, signedBy, comments) {
              ctx.read<QualityApprovalBloc>().add(AdvanceWorkflowStep(
                    signatureData: signatureData,
                    signedBy: signedBy,
                    comments: comments,
                  ));
            },
          ),
        ),
      ),
    );
  }

  /// Show the sheet for stage-level approval.
  /// [onSubmit] receives (signatureData, signedBy, comments) to dispatch
  /// [ApproveStage] from the caller.
  static Future<bool?> showForStage(
    BuildContext context, {
    required String stageName,
    String? pendingDisplay,
    required void Function(
            String signatureData, String signedBy, String? comments)
        onSubmit,
  }) {
    final bloc = context.read<QualityApprovalBloc>();
    final authBloc = context.read<AuthBloc>();
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => MultiBlocProvider(
        providers: [
          BlocProvider.value(value: bloc),
          BlocProvider.value(value: authBloc),
        ],
        child: SignatureApprovalSheet(
          title: 'Approve Stage: $stageName',
          subtitle: pendingDisplay != null ? 'Pending: $pendingDisplay' : null,
          onSubmit: onSubmit,
        ),
      ),
    );
  }

  @override
  State<SignatureApprovalSheet> createState() => _SignatureApprovalSheetState();
}

class _SignatureApprovalSheetState extends State<SignatureApprovalSheet>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  final _commentsCtrl = TextEditingController();
  final _signatureCtrl = SignatureController(
    penStrokeWidth: 2.5,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );

  bool _loadingSaved = true;
  String? _savedSignatureData; // base64 or data URI from profile
  bool _submitting = false;
  int _activeTab = 0; // 0 = saved, 1 = draw

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _tabCtrl.addListener(() {
      if (!_tabCtrl.indexIsChanging) {
        setState(() => _activeTab = _tabCtrl.index);
      }
    });
    _loadSavedSignature();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _commentsCtrl.dispose();
    _signatureCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSavedSignature() async {
    try {
      final result = await sl<SetuApiClient>().getUserSignature();
      final data = result['signatureData'] as String?;
      if (mounted) {
        setState(() {
          _savedSignatureData = (data != null && data.isNotEmpty) ? data : null;
          _loadingSaved = false;
          if (_savedSignatureData == null) {
            _tabCtrl.animateTo(1);
            _activeTab = 1;
          }
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loadingSaved = false;
          _tabCtrl.animateTo(1);
          _activeTab = 1;
        });
      }
    }
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);

    String? signatureData;

    if (_activeTab == 0 && _savedSignatureData != null) {
      signatureData = _savedSignatureData;
    } else {
      // Draw tab
      if (_signatureCtrl.isEmpty) {
        setState(() => _submitting = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Please draw your signature before approving.'),
            ),
          );
        }
        return;
      }
      final imageBytes = await _signatureCtrl.toPngBytes();
      if (imageBytes == null || !mounted) {
        setState(() => _submitting = false);
        return;
      }
      signatureData = 'data:image/png;base64,${base64Encode(imageBytes)}';
    }

    final authState = context.read<AuthBloc>().state;
    final signedBy = authState is AuthAuthenticated
        ? authState.user.fullName
        : 'Approver';

    widget.onSubmit(
      signatureData!,
      signedBy,
      _commentsCtrl.text.trim().isEmpty ? null : _commentsCtrl.text.trim(),
    );

    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: theme.dividerColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          Text(
            widget.title,
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          if (widget.subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              widget.subtitle!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
          ],
          const SizedBox(height: 16),

          // Tabs
          TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: 'Use Saved Signature'),
              Tab(text: 'Draw Signature'),
            ],
            labelStyle: const TextStyle(fontSize: 13),
          ),
          const SizedBox(height: 12),

          // Signature area — fixed height
          SizedBox(
            height: 180,
            child: TabBarView(
              controller: _tabCtrl,
              children: [
                // Tab 0: Saved signature from profile
                _loadingSaved
                    ? const Center(child: CircularProgressIndicator())
                    : _savedSignatureData != null
                        ? Container(
                            decoration: BoxDecoration(
                              border: Border.all(color: theme.dividerColor),
                              borderRadius: BorderRadius.circular(8),
                              color: Colors.white,
                            ),
                            padding: const EdgeInsets.all(8),
                            child: Center(
                              child: Image.memory(
                                _decodeSignature(_savedSignatureData!),
                                fit: BoxFit.contain,
                              ),
                            ),
                          )
                        : Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.draw_outlined,
                                    size: 40,
                                    color: theme.colorScheme.onSurface
                                        .withValues(alpha: 0.3)),
                                const SizedBox(height: 8),
                                Text(
                                  'No saved signature found.\nSwitch to "Draw" tab.',
                                  textAlign: TextAlign.center,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurface
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                              ],
                            ),
                          ),

                // Tab 1: Draw
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: theme.dividerColor),
                    borderRadius: BorderRadius.circular(8),
                    color: Colors.white,
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Signature(
                      controller: _signatureCtrl,
                      backgroundColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Clear button (draw tab only)
          if (_activeTab == 1)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: _signatureCtrl.clear,
                icon: const Icon(Icons.clear, size: 16),
                label: const Text('Clear'),
                style: TextButton.styleFrom(
                  textStyle: const TextStyle(fontSize: 12),
                ),
              ),
            )
          else
            const SizedBox(height: 8),

          // Optional comments
          TextField(
            controller: _commentsCtrl,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Comments (optional)',
              border: OutlineInputBorder(),
              hintText: 'Add any approval notes…',
              isDense: true,
            ),
          ),
          const SizedBox(height: 16),

          // Actions
          Row(
            children: [
              OutlinedButton(
                onPressed:
                    _submitting ? null : () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.verified_outlined, size: 16),
                label: Text(_submitting ? 'Approving…' : 'Approve'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.green.shade700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Decode base64 signature — handles both bare base64 and data URI format.
  Uint8List _decodeSignature(String data) {
    final base64Str = data.contains(',') ? data.split(',').last : data;
    return base64Decode(base64Str);
  }
}
