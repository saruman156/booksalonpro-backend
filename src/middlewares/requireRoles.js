module.exports = function requireRoles(...allowedRoles) {

  return function (req, res, next) {

    if (!req.user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required"
        }
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission"
        }
      });
    }

    next();
  };

};