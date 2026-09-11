function successResponse<T>(data?: T, message?: string) {
  return {
    status: true,
    ...(message ? { message } : {}),
    ...(data !== undefined ? { data } : {}),
  };
}

function errorResponse(message: string) {
  return {
    status: false,
    message,
  };
}

export { errorResponse, successResponse };
