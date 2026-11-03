import { getAdminAnalytics } from "../services/adminAnalyticsService.js";

export async function adminAnalytics(req, res, next) {
  try {
    res.json(await getAdminAnalytics());
  } catch (error) {
    next(error);
  }
}