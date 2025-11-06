var User = require('../models/user');
var Task = require('../models/tasks');
var helpers = require('./helpers');


module.exports = function (router) {
    router.route('/users')
        .get(function (req, res){
            var opts = helpers.buildQueryOptions(req, 'users');
            if (opts.error) {
                return res.status(400).json({message: 'bad request', data: null});
            }
            if (opts.count) {
                User.countDocuments(opts.where).exec(function (err, count) {
                    if (err) {
                        return res.status(500).json({message: 'server error', data: null});
                    }
                    return res.status(200).json({message: 'success', data: count });
                });
                return
            }
            var query = User.find(opts.where);
            if (opts.sort) query = query.sort(opts.sort);
            if (opts.select) query = query.select(opts.select);
            if (opts.skip) query = query.skip(opts.skip);
            if (typeof opts.limit === 'number' && opts.limit > 0) query = query.limit(opts.limit);
            query.exec(function (err, docs) {
                if (err) {
                    return res.status(500).json({message: 'server error', data: null});
                }
                return res.status(200).json({message: 'success', data: docs });
            });
        })
        .post(function (req, res) {
            var name = req.body.name;
            var email = req.body.email;
            if (!name || !email) {
                return res.status(400).json({ message: 'username and email are required', data: null });
            }
            User.findOne({ email: email }, function (err, exists) {
                if (err) {
                    return res.status(500).json({message: 'server error', data: null});
                }
                if (exists) {
                    return res.status(400).json({message: 'user with this email exists', data: null});
                }
                var user = new User({name: name, email: email});
                user.save(function (err, saved) {
                    if (err) {
                        return res.status(500).json({message: 'server error', data: null});
                    }
                    return res.status(201).json({message: 'user created', data: saved });
                });
            });
        });
        router.route('/users/:id')
            .get(function (req, res) {
                var opts = helpers.buildQueryOptions(req, 'users');
                if (opts.error) {
                    return res.status(400).json({message: opts.message, data: null});
                }
                var query = User.findById(req.params.id);
                if (opts.select) query = query.select(opts.select);
                query.exec(function (err, user) {
                    if (err) {
                        return res.status(500).json({message: 'server error', data: null});
                    }
                    if (!user) {
                        return res.status(404).json({message: 'user not found', data: null});
                    }
                    return res.status(200).json({message: 'success', data: user });
                });
            })
            .put(function (req, res) {
                var id = req.params.id;
                var name = req.body.name;
                var email = req.body.email;
                var pendingTasks = req.body.pendingTasks || [];

                if (!name || !email) {
                    return res.status(400).json({ message: 'username and email are required', data: null });
                }
                if (!Array.isArray(pendingTasks)) {
                    pendingTasks = [pendingTasks];
                }
                User.findOne({ email: email, _id: { $ne: id } }, function (err, otherUser) {
                    if (err) {
                        return res.status(500).json({ message: 'server error', data: null });
                    }
                    if (otherUser) {
                        return res.status(400).json({message: 'user with this email exists', data: null});
                    }
                    User.findById(id, function (err, user) {
                        if (err) {
                            return res.status(500).json({ message: 'server error', data: null });
                        }
                        if (!user) {
                            return res.status(404).json({ message: 'user not found', data: null });
                        }

                        user.name = name;
                        user.email = email;
                        user.pendingTasks = pendingTasks.map(String);

                        Task.updateMany(
                            { assignedUser: id },
                            { $set: { assignedUser: '', assignedUserName: 'unassigned' } },
                            function (err) {
                                if (err) {
                                    return res.status(500).json({ message: 'server error', data: null });
                                }

                                Task.updateMany(
                                    { _id: { $in: user.pendingTasks } },
                                    { $set: { assignedUser: id, assignedUserName: name } },
                                    function (err) {
                                        if (err) {
                                            return res.status(500).json({ message: 'server error', data: null });
                                        }

                                        user.save(function (err, updatedUser) {
                                            if (err) {
                                                return res.status(500).json({ message: 'server error', data: null });
                                            }
                                            return res.status(200).json({
                                                message: 'success',
                                                data: updatedUser
                                            });
                                        });
                                    }
                                );
                            }
                        );
                    });
                });
            })
            .delete(function (req, res) {
                var id = req.params.id;

                User.findById(id, function (err, user) {
                    if (err) {
                        return res.status(500).json({ message: 'server error', data: null });
                    }
                    if (!user) {
                        return res.status(404).json({ message: 'user not found', data: null });
                    }
                    Task.updateMany(
                        { assignedUser: id },
                        { $set: { assignedUser: '', assignedUserName: 'unassigned' } },
                        function (err) {
                            if (err) {
                                return res.status(500).json({ message: 'server error', data: null });
                            }

                            user.deleteOne(function (err) {
                                if (err) {
                                    return res.status(500).json({ message: 'server error', data: null });
                                }
                                return res.status(200).json({
                                    message: 'user deleted success',
                                    data: null
                                });
                            });
                        }
                    );
                });
            });

        return router;
    };