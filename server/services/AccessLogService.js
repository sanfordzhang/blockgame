/**
 * AccessLog Service
 * Handles log saving, aggregation queries, and caching for access analytics
 */

const AccessLog = require('../models/AccessLog');

// In-memory cache for stats results (TTL: 5 minutes)
const statsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DAU_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Save logs (single or batch) with validation
 */
async function saveLogs(logsArray) {
    const result = await AccessLog.bulkSaveValidated(logsArray);
    return result;
}

/**
 * Get overview statistics for a date range
 */
async function getStats(fromDate, toDate) {
    const cacheKey = `stats:${fromDate}:${toDate}`;
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    if (!fromDate) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        fromDate = d.toISOString().split('T')[0];
    }
    if (!toDate) {
        toDate = new Date().toISOString().split('T')[0];
    }

    const from = new Date(fromDate);
    // Include the full end day
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    try {
        const matchStage = {
            entryTime: { $gte: from, $lte: to }
        };

        // Total pageviews
        const totalPageviews = await AccessLog.countDocuments(matchStage);

        // Total unique users (by walletAddress, excluding null)
        const userPipeline = [
            { $match: { ...matchStage, walletAddress: { $ne: null } } },
            { $group: { _id: '$walletAddress' } },
            { $count: 'total' }
        ];
        const userResult = await AccessLog.aggregate(userPipeline);
        const totalUsers = userResult.length > 0 ? userResult[0].total : 0;

        // Total unique visits (by sessionId)
        const visitPipeline = [
            { $match: matchStage },
            { $group: { _id: '$sessionId' } },
            { $count: 'total' }
        ];
        const visitResult = await AccessLog.aggregate(visitPipeline);
        const totalVisits = visitResult.length > 0 ? visitResult[0].total : 0;

        // Average session duration (sum of durations per session / number of sessions)
        const durationPipeline = [
            { $match: { ...matchStage, duration: { $ne: null } } },
            {
                $group: {
                    _id: '$sessionId',
                    totalDuration: { $sum: '$duration' },
                    pageCount: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: null,
                    avgDuration: { $avg: '$totalDuration' }
                }
            }
        ];
        const durationResult = await AccessLog.aggregate(durationPipeline);
        const avgSessionDuration = durationResult.length > 0 && durationResult[0].avgDuration != null
            ? Math.round(durationResult[0].avgDuration * 10) / 10
            : 0;

        // Top pages by PV/UV
        const topPagesPipeline = [
            { $match: matchStage },
            {
                $group: {
                    _id: '$path',
                    pv: { $sum: 1 },
                    uv: { $addToSet: '$walletAddress' }
                }
            },
            {
                $project: {
                    path: '$_id',
                    pv: 1,
                    uvCount: { $size: { $filter: { input: '$uv', cond: { $ne: ['$$this', null] } } } },
                    _id: 0
                }
            },
            { $sort: { pv: -1 } },
            { $limit: 10 }
        ];
        const topPagesRaw = await AccessLog.aggregate(topPagesPipeline);
        const topPages = topPagesRaw.map(p => ({
            path: p.path,
            pv: p.pv,
            uv: p.uvCount
        }));

        const data = {
            period: { from: fromDate, to: toDate },
            totalUsers,
            totalVisits,
            totalPageviews,
            avgSessionDuration,
            topPages
        };

        // Cache result
        statsCache.set(cacheKey, { data, timestamp: Date.now() });

        return data;
    } catch (err) {
        console.error('[AccessLogService] getStats error:', err.message);
        throw err;
    }
}

/**
 * Get Daily Active Users (DAU) data
 */
async function getDAU(daysOrFromDate) {
    let days = 7;
    let startDate = null;

    if (typeof daysOrFromDate === 'string') {
        // It's a date string like "2026-04-01"
        startDate = new Date(daysOrFromDate);
    } else if (typeof daysOrFromDate === 'number') {
        days = Math.min(Math.max(daysOrFromDate, 1), 90); // clamp between 1-90
    }

    const cacheKey = `dau:${startDate || days}`;
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DAU_CACHE_TTL) {
        return cached.data;
    }

    if (!startDate) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);
    } else {
        startDate.setHours(0, 0, 0, 0);
    }

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    try {
        // Group by date, count connected users and visits
        const dauPipeline = [
            {
                $match: {
                    entryTime: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $project: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$entryTime' } },
                    walletAddress: 1,
                    sessionId: 1,
                    duration: 1
                }
            },
            {
                $group: {
                    _id: '$date',
                    connectedUsers: { $addToSet: { $cond: [{ $ne: ['$walletAddress', null] }, '$walletAddress', '__NULL__'] } },
                    visits: { $addToSet: '$sessionId' },
                    totalDurations: { $push: { $cond: [{ $ne: ['$duration', null] }, '$duration', 0] } }
                }
            },
            {
                $project: {
                    date: '$_id',
                    connectedUsers: {
                        $size: {
                            $filter: {
                                input: '$connectedUsers',
                                cond: { $ne: ['$$this', '__NULL__'] }
                            }
                        }
                    },
                    visits: { $size: '$visits' },
                    avgDuration: { $avg: '$totalDurations' },
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ];

        const dauData = await AccessLog.aggregate(dauPipeline);

        // Calculate summary statistics
        let sumConnectedDAU = 0;
        let sumVisitDAU = 0;
        let peakDate = '';
        let peakUsers = 0;

        dauData.forEach(day => {
            sumConnectedDAU += day.connectedUsers;
            sumVisitDAU += day.visits;
            if (day.connectedUsers > peakUsers) {
                peakUsers = day.connectedUsers;
                peakDate = day.date;
            }
        });

        const data = {
            period: { from: startDate.toISOString().split('T')[0], to: endDate.toISOString().split('T')[0] },
            dau: dauData.map(d => ({
                date: d.date,
                connectedUsers: d.connectedUsers,
                visits: d.visits,
                avgSessionDuration: Math.round((d.avgDuration || 0) * 10) / 10
            })),
            summary: {
                avgConnectedDAU: dauData.length > 0 ? Math.round(sumConnectedDAU / dauData.length * 10) / 10 : 0,
                avgVisitDAU: dauData.length > 0 ? Math.round(sumVisitDAU / dauData.length * 10) / 10 : 0,
                peakDate,
                peakUsers
            }
        };

        statsCache.set(cacheKey, { data, timestamp: Date.now() });

        return data;
    } catch (err) {
        console.error('[AccessLogService] getDAU error:', err.message);
        throw err;
    }
}

/**
 * Get a single user's recent visit trail
 */
async function getUserTrail(walletAddress, limit = 20) {
    limit = Math.min(Math.max(limit || 20, 1), 100); // clamp between 1-100

    const normalizedAddress = walletAddress.toLowerCase();

    try {
        const trails = await AccessLog.find({
            walletAddress: normalizedAddress
        })
            .select('sessionId path entryTime duration -_id')
            .sort({ entryTime: -1 })
            .limit(limit)
            .lean();

        // Get aggregate info
        const totalCount = await AccessLog.countDocuments({ walletAddress: normalizedAddress });
        const lastActiveDoc = await AccessLog.findOne({ walletAddress: normalizedAddress })
            .sort({ entryTime: -1 })
            .select('entryTime -_id')
            .lean();

        return {
            walletAddress: normalizedAddress,
            trails: trails.map(t => ({
                sessionId: t.sessionId,
                path: t.path,
                entryTime: t.entryTime,
                duration: t.duration
            })),
            totalPageviews: totalCount,
            lastActiveAt: lastActiveDoc ? lastActiveDoc.entryTime : null
        };
    } catch (err) {
        console.error('[AccessLogService] getUserTrail error:', err.message);
        throw err;
    }
}

/**
 * Clear all caches
 */
function clearCache() {
    statsCache.clear();
}

module.exports = {
    saveLogs,
    getStats,
    getDAU,
    getUserTrail,
    clearCache
};
