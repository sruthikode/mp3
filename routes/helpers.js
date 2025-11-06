module.exports.buildQueryOptions = function (req, type) {
    var where = {};
    var sort = {};
    var select = null;

    if (req.query.where) {
        try {
            where = JSON.parse(req.query.where);
        } catch (e) {
            return { error: true, message: 'Invalid JSON in where'};
        }
    }
    if (req.query.sort) {
        try {
            sort = JSON.parse(req.query.sort);
        } catch (e) {
            return { error: true, message: 'Invalid JSON in sort'};
        }
    }
    if (req.query.select) {
        try {
            select = JSON.parse(req.query.select);
        } catch (e) {
            return { error: true, message: 'Invalid JSON in select'};
        }
    } else if (req.query.filter) {
        try {
            select = JSON.parse(req.query.filter);
        } catch (e) {
            return { error: true, message: 'Invalid JSON in filter'};
        }
    }

    var skip = 0;
    if (req.query.skip) {
        skip = parseInt(req.query.skip, 10);
        if (isNaN(skip)) skip = 0;
    }

    var limit;
    if (req.query.limit) {
        limit = parseInt(req.query.limit, 10);
        if (isNaN(limit)) limit=0;
    } else {
        if (type === 'tasks') {
            limit = 100;
        }
    }

    var count = false;
    if (req.query.count === 'true' || req.query.count === true) {
        count = true;
    }

    return {
        error: false,
        where: where,
        sort: sort,
        select: select,
        skip: skip,
        limit: limit,
        count: count
    };
};