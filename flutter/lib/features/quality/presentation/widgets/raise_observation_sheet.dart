import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/quality_approval_bloc.dart';

/// Modal bottom sheet for QC inspector to raise a new observation.
/// Dispatches [RaiseObservation] to [QualityApprovalBloc].
class RaiseObservationSheet extends StatefulWidget {
  const RaiseObservationSheet({super.key});

  /// Show the sheet and return true if observation was submitted.
  static Future<bool?> show(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => BlocProvider.value(
        value: context.read<QualityApprovalBloc>(),
        child: const RaiseObservationSheet(),
      ),
    );
  }

  @override
  State<RaiseObservationSheet> createState() => _RaiseObservationSheetState();
}

class _RaiseObservationSheetState extends State<RaiseObservationSheet> {
  final _formKey = GlobalKey<FormState>();
  final _textCtrl = TextEditingController();
  String _type = 'Minor';
  final List<String> _photoUrls = [];
  bool _submitting = false;

  static const _types = ['Minor', 'Major', 'Critical'];

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final xfile =
        await picker.pickImage(source: ImageSource.camera, imageQuality: 70);
    if (xfile == null || !mounted) return;

    // Upload via bloc then capture URL
    final bloc = context.read<QualityApprovalBloc>();
    bloc.add(UploadObservationPhoto(xfile.path));

    // Listen for the uploaded URL in the next state
    final subscription = bloc.stream.listen((state) {
      if (state is ObservationPhotoUploaded && mounted) {
        setState(() => _photoUrls.add(state.url));
      }
    });
    // Cancel subscription after first upload response
    await Future.delayed(const Duration(seconds: 10));
    subscription.cancel();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    context.read<QualityApprovalBloc>().add(RaiseObservation(
          observationText: _textCtrl.text.trim(),
          type: _type,
          photos: List.from(_photoUrls),
        ));
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, bottom + 16),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
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
              'Raise Observation',
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),

            // Observation type selector
            Text('Type', style: theme.textTheme.labelLarge),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: _types
                  .map((t) => ButtonSegment(value: t, label: Text(t)))
                  .toList(),
              selected: {_type},
              onSelectionChanged: (s) =>
                  setState(() => _type = s.first),
              style: SegmentedButton.styleFrom(
                selectedBackgroundColor: _typeColor(_type).withValues(alpha: 0.15),
                selectedForegroundColor: _typeColor(_type),
              ),
            ),
            const SizedBox(height: 16),

            // Observation text
            TextFormField(
              controller: _textCtrl,
              maxLines: 4,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Observation Details *',
                alignLabelWithHint: true,
                border: OutlineInputBorder(),
                hintText: 'Describe what was observed…',
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),

            // Photos
            if (_photoUrls.isNotEmpty)
              Wrap(
                spacing: 8,
                children: _photoUrls
                    .map((url) => Chip(
                          avatar: const Icon(Icons.photo, size: 16),
                          label: Text(
                            'Photo ${_photoUrls.indexOf(url) + 1}',
                            style: const TextStyle(fontSize: 12),
                          ),
                          onDeleted: () =>
                              setState(() => _photoUrls.remove(url)),
                        ))
                    .toList(),
              ),

            Row(
              children: [
                TextButton.icon(
                  onPressed: _pickPhoto,
                  icon: const Icon(Icons.camera_alt_outlined, size: 18),
                  label: const Text('Add Photo'),
                ),
                const Spacer(),
                OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Submit'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _typeColor(String type) {
    switch (type) {
      case 'Major':
        return Colors.orange.shade700;
      case 'Critical':
        return Colors.red.shade700;
      default:
        return Colors.blue.shade700;
    }
  }
}
