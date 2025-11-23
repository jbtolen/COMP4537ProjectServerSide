const express = require("express");

const createClassificationsRouter = ({ db, usage }) => {
  if (!db || !usage) throw new Error("Classifications router requires db and usage middleware");
  const router = express.Router();
  const requireAuth = usage.requireAuth;
  const trackUsage = usage.trackUsage;

  /**
   * @swagger
   * /api/classifications:
   *   get:
   *     summary: List classifications for current user
   *     tags: [Classifications]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List returned
   */
  router.get(
    "/",
    requireAuth,
    trackUsage(),
    (req, res) => {
      const list = db.listClassificationsByUser(req.user.id);
      return res.status(200).json(list);
    }
  );

  /**
   * @swagger
   * /api/classifications/{id}:
   *   get:
   *     summary: Get a classification by id
   *     tags: [Classifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *     responses:
   *       200:
   *         description: Found
   *       404:
   *         description: Not found
   */
  router.get(
    "/:id",
    requireAuth,
    trackUsage(),
    (req, res) => {
      const item = db.getClassification(req.params.id);
      if (!item) return res.status(404).json({ error: "Not found" });
      if (item.user_id !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      return res.status(200).json(item);
    }
  );

  /**
   * @swagger
   * /api/classifications/{id}:
   *   put:
   *     summary: Update a classification
   *     tags: [Classifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           example:
   *             status: "reviewed"
   *     responses:
   *       200:
   *         description: Updated
   *       404:
   *         description: Not found
   */
  router.put(
    "/:id",
    requireAuth,
    trackUsage(),
    (req, res) => {
      const item = db.getClassification(req.params.id);
      if (!item) return res.status(404).json({ error: "Not found" });
      if (item.user_id !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const updated = db.updateClassification(req.params.id, {
        resultJson: req.body?.result ?? null,
        status: req.body?.status ?? null
      });
      return res.status(200).json(updated);
    }
  );

  /**
   * @swagger
   * /api/classifications/{id}:
   *   delete:
   *     summary: Delete a classification
   *     tags: [Classifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *     responses:
   *       204:
   *         description: Deleted
   *       404:
   *         description: Not found
   */
  router.delete(
    "/:id",
    requireAuth,
    trackUsage(),
    (req, res) => {
      const item = db.getClassification(req.params.id);
      if (!item) return res.status(404).json({ error: "Not found" });
      if (item.user_id !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const ok = db.deleteClassification(req.params.id);
      return res.status(ok ? 204 : 400).end();
    }
  );

  return router;
};

module.exports = createClassificationsRouter;
