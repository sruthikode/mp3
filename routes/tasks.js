var User = require('../models/user');
var Task = require('../models/tasks');
var helpers = require('./helpers');

function deadlineParse(value) {
    if (!value) return null;
    if (!isNaN(Number(value))) {
        return new Date(Number(value));
    }
    return new Date(value);
}

function completedParse(value) {
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
    }
    return !!value;
}

module.exports = function (router) {
    router.route('/tasks')
        .get(function (req, res) {
            var opts = helpers.buildQueryOptions(req, 'tasks');
            if (opts.error) {
                return res.status(400).json({ message: opts.message, data: null });
            }
            if (opts.count) {
                Task.countDocuments(opts.where).exec(function (err, count) {
                    if (err) {
                        return res.status(500).json({ message: 'server error', data: null });
                    }
                    return res.status(200).json({ message: 'success', data: count });
                });
                return;
            }
            var query = Task.find(opts.where);
            if (opts.sort) query = query.sort(opts.sort);
            if (opts.select) query = query.select(opts.select);
            if (opts.skip) query = query.skip(opts.skip);
            if (typeof opts.limit === 'number' && opts.limit > 0) {
                query = query.limit(opts.limit);
            }
            query.exec( function (err, docs) {
                if (err) {
                    return res.status(500).json({ message: 'server error', data: null });
                }
                return res.status(200).json({ message: 'success', data: docs });
            });

        })
        .post(function (req, res) {
            var name = req.body.name;
            var deadlineraw = req.body.deadline;
            if (!name || !deadlineraw) {
                return res.status(400).json({ message: 'task name and deadline are required', data: null });
            }
            var deadline = deadlineParse(deadlineraw);
            var completed = completedParse(req.body.completed);
            var assignedUserId = req.body.assignedUser || '';
            var assignedUserName = 'unassigned';

            function saveTask() {
                var task = new Task({
                    name: name,
                    description: req.body.description || '',
                    deadline: deadline,
                    completed: completed,
                    assignedUser: assignedUserId,
                    assignedUserName: assignedUserName
                });
                task.save(function (err, savedTask) {
                    if (err) {
                        return res.status(500).json({message: 'server error', data: null});
                    }
                    if (assignedUserId && !completed) {
                        User.updateOne(
                            { _id: assignedUserId },
                            { $addToSet: { pendingTasks: String(savedTask._id) } },
                            function () {
                                return res.status(201).json({ message: 'task created', data: savedTask });
                            }
                        );
                    } else {
                        return res.status(201).json({message: 'task created', data: savedTask});
                    }
                });
            }

            if (assignedUserId) {
                User.findById(assignedUserId, function (err, user) {
                    if (err) {
                        return res.status(500).json({message: 'server error', data: null});
                    }
                    if (!user) {
                        return res.status(400).json({ message: 'user does not exist', data: null });
                    }
                    assignedUserName = user.name;
                    saveTask();
                });
            } else {
                saveTask();
            }
        });
    router.route('/tasks/:id')
        .get(function (req, res) {
            var opts = helpers.buildQueryOptions(req, 'tasks');
            if (opts.error) {
                return res.status(400).json({ message: opts.message, data: null });
            }

            var query = Task.findById(req.params.id);
            if (opts.select) query = query.select(opts.select);

            query.exec(function (err, task) {
                if (err) {
                    return res.status(500).json({ message: 'server error', data: null });
                }
                if (!task) {
                    return res.status(404).json({ message: 'task not found', data: null });
                }
                return res.status(200).json({ message: 'success', data: task });
            });
        })
        .put(function (req, res) {
            var id = req.params.id;
            var name = req.body.name;
            var deadlineraw = req.body.deadline;

            if (!name || !deadlineraw) {
                return res.status(400).json({
                    message: 'task name and deadline are required',
                    data: null
                });
            }

            var deadline = deadlineParse(deadlineraw);
            var completed = completedParse(req.body.completed);
            var newAssignedUserId = req.body.assignedUser || '';

            Task.findById(id, function (err, task) {
                if (err) {
                    return res.status(500).json({ message: 'server error', data: null });
                }
                if (!task) {
                    return res.status(404).json({ message: 'task not found', data: null });
                }

                var oldAssignedUserId = task.assignedUser;
                function applyUpdate(assignedUserName) {
                    task.name = name;
                    task.description = req.body.description || '';
                    task.deadline = deadline;
                    task.completed = completed;
                    task.assignedUser = newAssignedUserId;
                    task.assignedUserName = assignedUserName;
                    
                    User.updateOne(
                        { _id: oldAssignedUserId },
                        { $pull: { pendingTasks: String(id) } },
                        function () {
                            task.save(function (err, updatedTask) {
                                if (err) {
                                    return res.status(500).json({ message: 'server error', data: null });
                                }
    
                                if (newAssignedUserId && !completed) {
                                    User.updateOne(
                                        { _id: newAssignedUserId },
                                        { $addToSet: { pendingTasks: String(id) } },
                                        function () {
                                            return res.status(200).json({
                                                message: 'task update success',
                                                data: updatedTask
                                            });
                                        }
                                    );
                                } else {
                                    return res.status(200).json({
                                        message: 'task update success',
                                        data: updatedTask
                                    });
                                }
                            }); 
                        }
                    );
                }
                if (newAssignedUserId) {
                    User.findById(newAssignedUserId, function (err, user) {
                        if (err) {
                            return res.status(500).json({ message: 'server error', data: null });
                        }
                        if (!user) {
                            return res.status(400).json({ message: 'user does not exist', data: null });
                        }
                        applyUpdate(user.name);
                    });
                } else {
                    applyUpdate('unassigned');
                }
            });
        })
        .delete(function (req, res) {
            var id = req.params.id;

            Task.findById(id, function (err, task) {
                if (err) {
                    return res.status(500).json({ message: 'server error', data: null });
                }
                if (!task) {
                    return res.status(404).json({ message: 'task not found', data: null });
                }

                var assignedUserId = task.assignedUser;
                User.updateOne(
                    { _id: assignedUserId },
                    { $pull: { pendingTasks: String(id) } },
                    function () {
                        task.deleteOne(function (err) {
                            if (err) {
                                return res.status(500).json({ message: 'server error', data: null });
                            }
                            return res.status(200).json({
                                message: 'task deleted success',
                                data: null
                            });
                        }); 
                    }
                );
            });
        });

    return router;
};