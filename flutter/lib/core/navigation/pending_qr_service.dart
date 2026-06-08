/// Stores a QR signature token that arrived before the user was logged in.
/// Consumed once after successful login to continue the pending confirmation.
class PendingQrService {
  PendingQrService._();
  static final PendingQrService instance = PendingQrService._();

  String? _token;

  void setPending(String token) => _token = token;

  /// Returns and clears the pending token (one-time use).
  String? consume() {
    final t = _token;
    _token = null;
    return t;
  }

  bool get hasPending => _token != null;
}
