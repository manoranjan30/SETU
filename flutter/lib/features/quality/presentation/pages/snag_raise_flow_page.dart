import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:setu_mobile/core/api/setu_api_client.dart';
import 'package:setu_mobile/core/media/photo_compressor.dart';
import 'package:setu_mobile/core/media/photo_thumbnail_strip.dart';
import 'package:setu_mobile/features/quality/data/models/snag_desnag_models.dart';
import 'package:setu_mobile/features/quality/presentation/bloc/snag_desnag_bloc.dart';
import 'package:setu_mobile/injection_container.dart';

/// Room > Activity > Common Point (or custom) > Capture wizard for raising
/// one snag point, matching the flow in the Snag/Desnag handoff.
///
/// Before-photos are optional by default; whether they're required depends
/// on the current process step's `raisePhotoRequired` flag
/// (`SnagProcessStep.raisePhotoRequired`, admin-configured per step) — this
/// page reads that flag from [processStep] rather than hard-coding photos
/// as mandatory. See `snag.service.ts`'s `resolvePhotoConfig`.
///
/// Offline-aware: photo upload falls back to a local copy (uploaded later by
/// [SyncService]) when the network call fails, mirroring
/// `raise_observation_sheet.dart`. Submission dispatches [RaiseSnagItemEvent]
/// to the shared [SnagDesnagBloc] (provided by the caller via
/// `BlocProvider.value`, see `snag_unit_workspace_page.dart`) rather than
/// calling [SetuApiClient] directly, so a raise made without connectivity is
/// queued and shown optimistically instead of failing outright — see
/// [SnagDesnagBloc._runMutation]'s doc comment for how that queueing works.
class SnagRaiseFlowPage extends StatefulWidget {
  final int projectId;
  final List<SnagRoom> rooms;
  final SnagProcessStep? processStep;

  const SnagRaiseFlowPage({
    super.key,
    required this.projectId,
    required this.rooms,
    required this.processStep,
  });

  @override
  State<SnagRaiseFlowPage> createState() => _SnagRaiseFlowPageState();
}

enum _RaiseStep { room, activity, point, capture }

class _SnagRaiseFlowPageState extends State<SnagRaiseFlowPage> {
  _RaiseStep _step = _RaiseStep.room;

  SnagRoom? _selectedRoom;
  bool _roomSkipped = false;

  SnagProcessActivity? _selectedActivity;
  bool _isOthers = false;
  final _customTradeCtrl = TextEditingController();

  SnagCommonPoint? _selectedPoint;
  bool _isCustomPoint = false;

  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _priority = 'medium';
  final List<String> _photoUrls = [];
  bool _uploadingPhoto = false;
  bool _saving = false;

  // Contractor/vendor selection — August 2026 handoff. Loaded once when the
  // raise flow opens rather than plumbed through the overview bloc, since
  // this is the only screen that needs it.
  List<SnagVendor> _vendors = [];
  SnagVendor? _selectedVendor;
  bool _vendorLoading = true;

  @override
  void initState() {
    super.initState();
    _loadVendors();
  }

  Future<void> _loadVendors() async {
    try {
      final raw = await sl<SetuApiClient>().getSnagVendors(widget.projectId);
      final vendors = raw.map((e) => SnagVendor.fromJson(e as Map<String, dynamic>)).toList();
      // Largest-value-WO vendor first, when the backend sends a value —
      // both for display order and so _defaultVendor below can just take
      // the head of the list. Vendors without a value keep their original
      // (name-sorted) order at the end.
      vendors.sort((a, b) => (b.totalWorkOrderValue ?? -1).compareTo(a.totalWorkOrderValue ?? -1));
      if (mounted) {
        setState(() {
          _vendors = vendors;
          _vendorLoading = false;
          _selectedVendor ??= _defaultVendor(vendors);
        });
      }
    } catch (_) {
      // Non-fatal — vendor is optional; the raise flow still works without it.
      if (mounted) setState(() => _vendorLoading = false);
    }
  }

  /// Pre-selects the vendor with the largest work-order value so the
  /// Checker doesn't have to pick a vendor on every single snag point —
  /// they can still change it per-point via the picker. Returns `null`
  /// (no default) when no vendor carries a value, which is the case today:
  /// `GET /snag/:projectId/vendors` doesn't yet return `totalWorkOrderValue`
  /// even though the backend's `WorkOrder.totalAmount` the value would come
  /// from already exists — this needs a small backend addition before the
  /// default actually activates. See [SnagVendor.totalWorkOrderValue].
  SnagVendor? _defaultVendor(List<SnagVendor> vendors) {
    final withValue = vendors.where((v) => (v.totalWorkOrderValue ?? 0) > 0).toList();
    if (withValue.isEmpty) return null;
    return withValue.reduce((a, b) => (a.totalWorkOrderValue ?? 0) >= (b.totalWorkOrderValue ?? 0) ? a : b);
  }

  @override
  void dispose() {
    _customTradeCtrl.dispose();
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  void _goTo(_RaiseStep step) => setState(() => _step = step);

  bool _handleBack() {
    switch (_step) {
      case _RaiseStep.room:
        return true; // let the page pop
      case _RaiseStep.activity:
        _goTo(_RaiseStep.room);
        return false;
      case _RaiseStep.point:
        _goTo(_RaiseStep.activity);
        return false;
      case _RaiseStep.capture:
        _goTo(_RaiseStep.point);
        return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<SnagDesnagBloc, SnagDesnagState>(
      listener: (context, state) {
        if (!_saving) return; // ignore state changes unrelated to our submit
        if (state is SnagActionSuccess) {
          setState(() => _saving = false);
          Navigator.of(context).pop(true);
        } else if (state is SnagDesnagError) {
          setState(() => _saving = false);
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(state.message),
            backgroundColor: Colors.red.shade700,
          ));
        }
      },
      child: PopScope(
        canPop: _step == _RaiseStep.room,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _handleBack();
        },
        child: Scaffold(
          appBar: AppBar(
            title: const Text('Raise Snag', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () {
                if (_handleBack()) Navigator.of(context).pop();
              },
            ),
          ),
          body: switch (_step) {
            _RaiseStep.room => _buildRoomStep(),
            _RaiseStep.activity => _buildActivityStep(),
            _RaiseStep.point => _buildPointStep(),
            _RaiseStep.capture => _buildCaptureStep(),
          },
        ),
      ),
    );
  }

  // ── Step 1: Room ──────────────────────────────────────────────────────

  Widget _buildRoomStep() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Select Room', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
        const SizedBox(height: 8),
        for (final room in widget.rooms)
          _OptionTile(
            label: room.name,
            selected: _selectedRoom?.id == room.id,
            onTap: () {
              setState(() {
                _selectedRoom = room;
                _roomSkipped = false;
              });
              _goTo(_RaiseStep.activity);
            },
          ),
        const SizedBox(height: 8),
        _OptionTile(
          label: 'No specific room / skip',
          icon: Icons.skip_next_outlined,
          selected: _roomSkipped,
          onTap: () {
            setState(() {
              _selectedRoom = null;
              _roomSkipped = true;
            });
            _goTo(_RaiseStep.activity);
          },
        ),
      ],
    );
  }

  // ── Step 2: Activity ─────────────────────────────────────────────────

  Widget _buildActivityStep() {
    final activities = widget.processStep?.activities ?? const [];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Select Activity', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
        const SizedBox(height: 8),
        for (final activity in activities)
          _OptionTile(
            label: activity.activityName,
            selected: !_isOthers && _selectedActivity?.id == activity.id,
            onTap: () {
              setState(() {
                _selectedActivity = activity;
                _isOthers = false;
              });
              _goTo(_RaiseStep.point);
            },
          ),
        const SizedBox(height: 8),
        _OptionTile(
          label: 'Others',
          icon: Icons.more_horiz,
          selected: _isOthers,
          onTap: () {
            setState(() {
              _selectedActivity = null;
              _isOthers = true;
            });
            _goTo(_RaiseStep.point);
          },
        ),
      ],
    );
  }

  // ── Step 3: Common point (or custom) ─────────────────────────────────

  Widget _buildPointStep() {
    if (_isOthers) {
      // "Others" skips predefined common points entirely — straight to a
      // custom trade name plus custom snag title on the capture step.
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Custom Activity / Trade', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
          const SizedBox(height: 8),
          TextField(
            controller: _customTradeCtrl,
            decoration: const InputDecoration(
              labelText: 'Activity / Trade Name',
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () {
              setState(() {
                _selectedPoint = null;
                _isCustomPoint = true;
                _titleCtrl.clear();
              });
              _goTo(_RaiseStep.capture);
            },
            child: const Text('Continue'),
          ),
        ],
      );
    }

    final points = _selectedActivity?.commonPoints ?? const [];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Select Snag Point', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.grey.shade700)),
        const SizedBox(height: 8),
        for (final point in points)
          _OptionTile(
            label: point.title,
            subtitle: point.requiresEvidence ? 'Evidence required' : null,
            selected: !_isCustomPoint && _selectedPoint?.id == point.id,
            onTap: () {
              setState(() {
                _selectedPoint = point;
                _isCustomPoint = false;
                _titleCtrl.text = point.title;
                _descCtrl.text = point.description ?? '';
              });
              _goTo(_RaiseStep.capture);
            },
          ),
        const SizedBox(height: 8),
        _OptionTile(
          label: 'Custom snag point',
          icon: Icons.edit_outlined,
          selected: _isCustomPoint,
          onTap: () {
            setState(() {
              _selectedPoint = null;
              _isCustomPoint = true;
              _titleCtrl.clear();
              _descCtrl.clear();
            });
            _goTo(_RaiseStep.capture);
          },
        ),
      ],
    );
  }

  // ── Step 4: Capture ──────────────────────────────────────────────────

  Widget _buildCaptureStep() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _titleCtrl,
          decoration: const InputDecoration(labelText: 'Snag Title *', border: OutlineInputBorder(), isDense: true),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _descCtrl,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder(), isDense: true),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: _priority,
          decoration: const InputDecoration(labelText: 'Priority', border: OutlineInputBorder(), isDense: true),
          items: const [
            DropdownMenuItem(value: 'low', child: Text('Low')),
            DropdownMenuItem(value: 'medium', child: Text('Medium')),
            DropdownMenuItem(value: 'high', child: Text('High')),
          ],
          onChanged: (v) => setState(() => _priority = v ?? 'medium'),
        ),
        const SizedBox(height: 10),
        _VendorPickerField(
          vendors: _vendors,
          loading: _vendorLoading,
          selected: _selectedVendor,
          onChanged: (v) => setState(() => _selectedVendor = v),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Text(
              widget.processStep?.raisePhotoRequired == true ? 'Before Photos *' : 'Before Photos (optional)',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey.shade700),
            ),
            const Spacer(),
            TextButton.icon(
              onPressed: _uploadingPhoto ? null : _pickAndUploadPhoto,
              icon: _uploadingPhoto
                  ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.add_a_photo_outlined, size: 16),
              label: Text(_uploadingPhoto ? 'Uploading…' : 'Add Photo'),
            ),
          ],
        ),
        if (_photoUrls.isEmpty && widget.processStep?.raisePhotoRequired == true)
          Text('This project requires at least one before-photo.', style: TextStyle(fontSize: 11, color: Colors.red.shade700))
        else if (_photoUrls.isNotEmpty)
          PhotoThumbnailStrip(
            photoUrls: _photoUrls,
            canDelete: true,
            onDelete: (url) => setState(() => _photoUrls.remove(url)),
          ),
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: _saving ? null : _submit,
          icon: _saving
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.check),
          label: Text(_saving ? 'Saving…' : 'Save Snag Point'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        ),
      ],
    );
  }

  Future<void> _pickAndUploadPhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Camera'),
              onTap: () => Navigator.of(ctx).pop(ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Gallery'),
              onTap: () => Navigator.of(ctx).pop(ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;

    final photo = await ImagePicker().pickImage(source: source, imageQuality: 90);
    if (photo == null || !mounted) return;

    setState(() => _uploadingPhoto = true);
    try {
      final compressed = await PhotoCompressor.compress(photo.path);
      try {
        // Online path: upload immediately and store the server URL.
        final result = await sl<SetuApiClient>().uploadFile(filePath: compressed);
        final url = result['url'] as String? ?? result['path'] as String? ?? '';
        if (url.isNotEmpty && mounted) setState(() => _photoUrls.add(url));
      } catch (_) {
        // Offline path: save a compressed copy locally — SyncService
        // uploads it once the queued snag point mutation is replayed.
        final localPath = await _savePhotoLocally(compressed);
        if (mounted) {
          setState(() => _photoUrls.add(localPath));
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: const Text('Photo saved locally — will upload when online.'),
            backgroundColor: Colors.orange.shade700,
          ));
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Could not capture photo. Please try again.'),
          backgroundColor: Colors.red.shade700,
        ));
      }
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  /// Saves a photo to the app's pending-snag-photos directory so it survives
  /// until [SyncService] can upload it alongside the queued snag point.
  Future<String> _savePhotoLocally(String sourcePath) async {
    final dir = await getApplicationDocumentsDirectory();
    final pendingDir = Directory(p.join(dir.path, 'pending_snag_photos'));
    await pendingDir.create(recursive: true);
    final fileName = '${DateTime.now().millisecondsSinceEpoch}_snag.jpg';
    final dest = File(p.join(pendingDir.path, fileName));
    await File(sourcePath).copy(dest.path);
    return dest.path; // absolute local path used as placeholder URL
  }

  void _submit() {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a snag title.')));
      return;
    }
    if (_photoUrls.isEmpty && widget.processStep?.raisePhotoRequired == true) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('This project requires at least one before-photo.')));
      return;
    }

    setState(() => _saving = true);
    final trade = _isOthers
        ? (_customTradeCtrl.text.trim().isEmpty ? null : _customTradeCtrl.text.trim())
        : _selectedActivity?.activityName;

    // Dispatch to the shared SnagDesnagBloc (provided by the caller via
    // BlocProvider.value) rather than calling the API directly — this is
    // what lets the raise queue for later delivery when offline. Success/
    // error is handled by the BlocListener in build().
    context.read<SnagDesnagBloc>().add(RaiseSnagItemEvent(
      qualityRoomId: _selectedRoom?.id,
      roomLabel: _selectedRoom?.name,
      defectTitle: title,
      defectDescription: _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
      trade: trade,
      vendorId: _selectedVendor?.id,
      vendorName: _selectedVendor?.name,
      priority: _priority,
      linkedChecklistItemId: _isCustomPoint ? null : _selectedPoint?.id.toString(),
      beforePhotoUrls: _photoUrls,
    ));
  }
}

/// Compact trigger + search-and-select bottom sheet for the optional
/// Contractor/Vendor field, matching `AssigneePicker`'s convention
/// elsewhere in the app. Selection is never required — per the vendor
/// handoff, the backend stores an empty vendor when none is picked.
class _VendorPickerField extends StatelessWidget {
  final List<SnagVendor> vendors;
  final bool loading;
  final SnagVendor? selected;
  final ValueChanged<SnagVendor?> onChanged;

  const _VendorPickerField({
    required this.vendors,
    required this.loading,
    required this.selected,
    required this.onChanged,
  });

  Future<void> _showPicker(BuildContext context) async {
    final result = await showModalBottomSheet<_VendorPickResult>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _VendorPickerSheet(vendors: vendors, selected: selected),
    );
    if (result != null) onChanged(result.vendor);
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: loading || vendors.isEmpty ? null : () => _showPicker(context),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: 'Contractor / Vendor (optional)',
          border: const OutlineInputBorder(),
          isDense: true,
          suffixIcon: loading
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                )
              : const Icon(Icons.engineering_outlined, size: 18),
        ),
        child: Text(
          loading
              ? 'Loading vendors…'
              : selected?.name ?? (vendors.isEmpty ? 'No vendors found for this project' : 'Select vendor'),
          style: TextStyle(color: selected == null ? Colors.grey.shade500 : null, fontSize: 13),
        ),
      ),
    );
  }
}

class _VendorPickResult {
  final SnagVendor? vendor;
  const _VendorPickResult(this.vendor);
}

class _VendorPickerSheet extends StatefulWidget {
  final List<SnagVendor> vendors;
  final SnagVendor? selected;
  const _VendorPickerSheet({required this.vendors, required this.selected});

  @override
  State<_VendorPickerSheet> createState() => _VendorPickerSheetState();
}

class _VendorPickerSheetState extends State<_VendorPickerSheet> {
  final _searchCtrl = TextEditingController();
  late List<SnagVendor> _filtered = widget.vendors;

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() {
      final q = _searchCtrl.text.toLowerCase();
      setState(() => _filtered = q.isEmpty
          ? widget.vendors
          : widget.vendors.where((v) =>
              v.name.toLowerCase().contains(q) ||
              (v.vendorCode?.toLowerCase().contains(q) ?? false) ||
              (v.contactPerson?.toLowerCase().contains(q) ?? false)).toList());
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: TextField(
                controller: _searchCtrl,
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Search vendor…',
                  prefixIcon: Icon(Icons.search, size: 20),
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  if (widget.selected != null)
                    ListTile(
                      leading: const Icon(Icons.clear, color: Colors.grey),
                      title: const Text('Clear selection'),
                      onTap: () => Navigator.of(context).pop(const _VendorPickResult(null)),
                    ),
                  for (final vendor in _filtered)
                    ListTile(
                      leading: Icon(
                        Icons.engineering_outlined,
                        color: widget.selected?.id == vendor.id ? Colors.indigo : Colors.grey,
                      ),
                      title: Text(vendor.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      subtitle: (vendor.vendorCode != null || vendor.contactPerson != null)
                          ? Text(
                              [if (vendor.vendorCode != null) vendor.vendorCode!, if (vendor.contactPerson != null) vendor.contactPerson!].join(' • '),
                              style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                            )
                          : null,
                      selected: widget.selected?.id == vendor.id,
                      onTap: () => Navigator.of(context).pop(_VendorPickResult(vendor)),
                    ),
                  if (_filtered.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(child: Text('No matching vendors', style: TextStyle(color: Colors.grey))),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  final String label;
  final String? subtitle;
  final IconData? icon;
  final bool selected;
  final VoidCallback onTap;

  const _OptionTile({
    required this.label,
    this.subtitle,
    this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: selected ? Colors.indigo : Colors.grey.shade200, width: selected ? 1.5 : 1),
      ),
      child: ListTile(
        leading: icon != null ? Icon(icon, color: Colors.indigo) : null,
        title: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        subtitle: subtitle != null ? Text(subtitle!, style: TextStyle(fontSize: 11, color: Colors.orange.shade700)) : null,
        trailing: const Icon(Icons.chevron_right, size: 18),
        onTap: onTap,
      ),
    );
  }
}
