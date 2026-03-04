/// Custom API exceptions for SETU Mobile
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic data;

  const ApiException({
    required this.message,
    this.statusCode,
    this.data,
  });

  @override
  String toString() => 'ApiException: $message (statusCode: $statusCode)';

  // Factory constructors for common errors
  const factory ApiException.networkError(String message) = NetworkException;
  const factory ApiException.badRequest(String message) = BadRequestException;
  const factory ApiException.unauthorized([String message]) = UnauthorizedException;
  const factory ApiException.forbidden() = ForbiddenException;
  const factory ApiException.notFound() = NotFoundException;
  const factory ApiException.serverError() = ServerErrorException;
  const factory ApiException.httpError(int statusCode, String message) = HttpException;
  const factory ApiException.cancelled() = CancelledException;
  const factory ApiException.unknown(String message) = UnknownException;
}

class NetworkException extends ApiException {
  const NetworkException(String message) : super(message: message);
}

class BadRequestException extends ApiException {
  const BadRequestException(String message) : super(message: message, statusCode: 400);
}

class UnauthorizedException extends ApiException {
  const UnauthorizedException([String message = 'Unauthorized']) : super(message: message, statusCode: 401);
}

class ForbiddenException extends ApiException {
  const ForbiddenException() : super(message: 'Forbidden', statusCode: 403);
}

class NotFoundException extends ApiException {
  const NotFoundException() : super(message: 'Not found', statusCode: 404);
}

class ServerErrorException extends ApiException {
  const ServerErrorException() : super(message: 'Server error', statusCode: 500);
}

class HttpException extends ApiException {
  const HttpException(int statusCode, String message)
      : super(message: message, statusCode: statusCode);
}

class CancelledException extends ApiException {
  const CancelledException() : super(message: 'Request cancelled');
}

class UnknownException extends ApiException {
  const UnknownException(String message) : super(message: message);
}

/// Sync-specific exceptions
class SyncException implements Exception {
  final String message;
  final int? entityId;
  final String? entityType;

  const SyncException({
    required this.message,
    this.entityId,
    this.entityType,
  });

  @override
  String toString() => 'SyncException: $message (entity: $entityType/$entityId)';
}

class ConflictException extends SyncException {
  const ConflictException({
    super.entityType,
    super.entityId,
  }) : super(
          message: 'Data conflict detected',
        );
}

class OfflineException extends SyncException {
  const OfflineException() : super(message: 'Device is offline');
}
