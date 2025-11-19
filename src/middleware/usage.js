const createUsageMiddleware = (authService, db) => {
  if (!authService || !db) throw new Error("Usage middleware requires authService and db instances");

  const getToken = (req) => {
    const fromCookie = req.cookies?.[authService.cookieName];
    if (fromCookie) return fromCookie;
    const authz = req.headers.authorization || "";
    if (authz.toLowerCase().startsWith("bearer ")) {
      return authz.slice(7).trim();
    }
    return null;
  };

  const requireAuth = (req, res, next) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const payload = authService.verify(token);
    if (!payload) return res.status(401).json({ error: "Invalid token" });
    const profile = authService.getUserProfile(payload.sub);
    if (!profile) return res.status(401).json({ error: "User not found" });
    req.user = profile;
    return next();
  };

  const trackUsage = (label) => (req, res, next) => {
    if (!req.user) return res.status(500).json({ error: "Auth check required before usage tracking" });
    const quotaLimit = req.user?.usage?.limit ?? 20;
    db.ensureUsageRow(req.user.id, quotaLimit, req.user?.usage?.used ?? 0);
    db.incrementUsage(req.user.id, 1);

    const endpointPath =
      label || `${req.baseUrl || ""}${req.route?.path || req.path || ""}` || req.originalUrl || "/";
    db.recordEndpointCall(req.method || "GET", endpointPath);

    const refreshed = authService.getUserProfile(req.user.id);
    if (refreshed) {
      req.user = refreshed;
      res.locals.apiUsage = refreshed.usage;
      if (refreshed.usage) {
        const headerValue = `${refreshed.usage.used}/${refreshed.usage.limit}`;
        res.setHeader("X-API-Usage", headerValue);
        if (refreshed.usage.used >= refreshed.usage.limit) {
          const warning = "Free API quota reached. Service continues but please upgrade.";
          res.locals.apiUsageWarning = warning;
          res.setHeader("X-API-Warning", warning);
        }
      }
    }

    return next();
  };

  return { requireAuth, trackUsage };
};

module.exports = createUsageMiddleware;
