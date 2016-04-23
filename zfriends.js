
describe('/friends', function( ) {
    var endpoint = this.title;
    var rootUrl = testContext.getRoot( ) + endpoint;

    this.timeout(0);

    var credentials = { };

    var statuses = ['pending', 'accepted', 'deleted', 'blocked'];

    var hex = crypto.randomBytes(4).toString('hex').toUpperCase();

    // user that will be used to perform requests with
    var testUser = {username: 'FRIEND' + hex, password: 'FRIEND' + hex + 'PASSWORD'};
    var testUserCredentials = { };

    var dummyUser1 = {username: 'FRIEND_DUMMY1' + hex, password: 'FRIEND' + hex + 'PASSWORD'};
    var dummyUser2 = {username: 'FRIEND_DUMMY2' + hex, password: 'FRIEND' + hex + 'PASSWORD'};

    var userFriends = { };

    function addAuth(obj, isTestUser) {
        var result = JSON.parse(JSON.stringify(obj));
        var underscore = '_';
        if (process.env.DISABLE_UNDERSCORES)
            underscore = '';
        if (isTestUser) {
            result[underscore + "session"] = testUserCredentials.session;
            result[underscore + "token"] = testUserCredentials.token;
        } else {
            result[underscore + "session"] = credentials.session;
            result[underscore + "token"] = credentials.token;
        }
        return result;
    }

    function testFail(done, test, obj, str) {

        test.should.have.property('status');
        test.status.should.equal('fail');
        test.should.have.property('reason');
        test.reason.should.have.property(obj);
        test.reason[obj].should.equal(str);

        done( );
    }

    function shouldReturnSuccess(test) {
        test.should.have.property('status');
        test.status.should.equal('success');
        test.should.have.property('data');
    }

    function checkData(test, key, checkAgainst) {
            test.data[key].should.equal(checkAgainst);
    }

    function checkDataStatus(test, status) {
        if (status === null || status === undefined) {
            statuses.should.containEql(test.data.status);
        } else {
            test.data.status.should.equal(status);
        }
    }

    before(function (done) {
        var payload;

        async.series([
            function (callback) {
                // login admin
                utils.get(testContext.getRoot( ) + '/users', '/login', {
                    username: testContext.knownAdmin,
                    password: testContext.knownAdminPassword
                }, function (err, result) {
                    if (err) return callback(err);
                    credentials.session = result.data.session;
                    credentials.token = result.data.token;
                    // was data recieved correctly
                    if (result.data.id) {
                        credentials.id = result.data.id;
                        credentials.isAdmin = true;
                        callback();
                    }
                    else {
                        utils.get(testContext.getRoot( ) + '/users', '/find/' + testContext.knownAdmin, {
                            "_session": credentials.session,
                            "_token": credentials.token
                        }, function (err, result) {
                            if (err) return callback(err);
                            credentials.id = result.data.id;

                            utils.get(testContext.getRoot( ) + '/users/', credentials.id + '/get', {
                                "_session": credentials.session,
                                "_token": credentials.token
                            }, function (err, result) {
                                if (err) return callback(err);
                                credentials.isAdmin = result.data.isAdmin;
                                callback();
                            });
                        });
                    }
                });
            },

            // create logged in test user
            function(callback) {
                // create test user if not already existing
                utils.post(testContext.getRoot( ) + '/users', '/create', testUser, function (err, result) {
                    if (err) return callback(err);

                    // login test user
                    utils.get(testContext.getRoot( ) + '/users', '/login', testUser, function(err, results) {
                        if (err) return callback(err);

                        testUserCredentials.session = results.data.session;
                        testUserCredentials.token = results.data.token;

                        utils.get(testContext.getRoot( ) + '/users', '/find/' + testUser.username, {
                            "_session": testUserCredentials.session,
                            "_token": testUserCredentials.token
                        }, function (err, getRes) {
                            if (err) return callback(err);
                            testUserCredentials.id = getRes.data.id;
                            callback();
                        });
                    });
                });
            },

            // create test dummy1
            function(callback) {
                utils.post(testContext.getRoot() + '/users', '/create', dummyUser1, function (err, result) {
                    if (err) return callback(err);

                    // create was successfull (did not already exist)
                    if (result.data.id) {
                        dummyUser1.id = result.data.id;
                        return callback( );
                    }

                    // create failed (did already exist)
                    utils.get(testContext.getRoot() + '/users', '/find/' + dummyUser1.username, { "_session": credentials.session, "_token": credentials.token }, function(err, results) {
                        if (err) return callback(err);

                        dummyUser1.id = results.data.id;
                        return callback( );
                    });
                });
            },

            // create test dummy2
            function(callback) {
                utils.post(testContext.getRoot() + '/users', '/create', dummyUser2, function (err, result) {
                    if (err) return callback(err);

                    // create was successfull (did not already exist)
                    if (result.data.id) {
                        dummyUser2.id = result.data.id;
                        return callback( );
                    }

                    // create failed (did already exist)
                    utils.get(testContext.getRoot() + '/users', '/find/' + dummyUser2.username, { "_session": credentials.session, "_token": credentials.token }, function(err, result) {
                        if (err) return callback(err);

                        dummyUser2.id = result.data.id;
                        return callback( );
                    });
                });
            }
        ], function (err) {
            done( );
        });
    });

    describe('Verify test context', function( ) {

        it('credentials should be present', function(done) {
            credentials.should.have.properties(['session', 'token', 'id', 'isAdmin']);
            credentials.isAdmin.should.equal(true);
            done();
        });

        it('test user should exist and be logged in', function(done) {
            testUserCredentials.should.have.properties(['session', 'token', 'id']);
            done();
        });

        it('dummy user 1 should exists', function(done) {
           dummyUser1.should.have.property('id');
           done( );
        });

        it('dummy user 2 should exists', function(done) {
            dummyUser2.should.have.property('id');
            done( );
        });

    });

    describe('/create', function ( ) {
        var method = '/create';
        var payload = { };

        before(function (done) {
            this.method = method;

            var body = {
                to: 'NOT_VALID_USER',
                from: testContext.knownAdmin,
                status: 'pending'
            };

            async.series([
                function(callback) {
                    utils.post(rootUrl, method, addAuth(body), function (err, result) {
                        if (err) return callback(err);

                        payload.test1 = result;
                        callback( );
                    });
                },

                // test invalid status
                function(callback) {
                    // update body to have valid to (username)
                    body.to = testUser.username;
                    body.status = 'INVALID_STATUS';

                    utils.post(rootUrl, method, addAuth(body), function (err, result) {
                        if (err) return callback(err);

                        payload.test2 = result;

                        callback( );
                    });
                },

                // test invalid status (deleted)
                function(callback) {
                    // update body to have valid to (username)
                    body.to = testUser.username;
                    body.status = 'deleted';

                    utils.post(rootUrl, method, addAuth(body), function (err, result) {
                        if (err) return callback(err);

                        payload.test3 = result;

                        callback( );
                    });
                },

                // test invalid status (accepted)
                function(callback) {
                    // update body to have valid to (username)
                    body.to = testUser.username;
                    body.status = 'accepted';

                    utils.post(rootUrl, method, addAuth(body), function (err, result) {
                        if (err) return callback(err);

                        payload.test4 = result;

                        callback( );
                    });
                },


                // test when admin passes in a non created user for from
                function(callback) {
                    // update from to be invalid
                    body.from = 'INVALID_USER_INVALID_BLAH';
                    body.status = 'pending';

                    utils.post(rootUrl, method, addAuth(body), function (err, result) {
                        if (err) return callback(err);

                        payload.test5 = result;

                        callback( );
                    });
                },

                // test valid to(userName), from(valid), status('pending')
                function(callback) {
                    // update body to have valid status
                    body.from = testContext.knownAdmin;
                    body.status = 'pending';

                    utils.post(rootUrl, method, addAuth(body), function (err, result) {
                        if (err) return callback(err);

                        payload.test6 = result;

                        // set id for later tests
                        if (result.data) {
                            userFriends.id = result.data.id;
                            userFriends.createdOn = result.data.createdOn;
                        }

                        callback( );
                    });
                },

                // test duplicate request of from to to
                function(callback) {
                    utils.post(rootUrl, method, addAuth(body), function (err, result) {
                        if (err) return callback(err);

                        payload.test7 = result;
                        callback();
                    });
                },

                // test duplicate request of to to from (also tests using id's as to and from)
                function(callback) {
                    // swap to an from
                    body.from = testUserCredentials.id;
                    body.to = credentials.id;

                    utils.post(rootUrl, method, addAuth(body, true), function (err, result) {
                        if (err) return callback(err);

                        payload.test8 = result;
                        callback();
                    });
                },

                // test admin creating friend between to users other than itself
                //   + also test blocked status
                function(callback) {
                    body.from = dummyUser1.id;
                    body.to = dummyUser2.id;
                    body.status = 'blocked';

                    utils.post(rootUrl, method, addAuth(body), function (err, result) {
                        if (err) return callback(err);

                        userFriends.dummyToDummyID = result.data.id;
                        userFriends.dummyToDummyOn = result.data.createdOn;
                        payload.test9 = result;
                        callback( );
                    });
                },

                // test normal user creating friend between self and other (also test not passing in from)
                function(callback) {

                    var newBody = {
                        to: dummyUser1.id,
                        status: 'pending'
                    }

                    utils.post(rootUrl, method, addAuth(newBody, true), function (err, result) {
                        if (err) return callback(err);

                        userFriends.toToDummyID = result.data.id;
                        userFriends.toToDummyOn = result.data.createdOn;
                        payload.test10 = result;
                        callback( );
                    });
                }
            ], function(err) {
                done( );
            });
        });

        // test 1
        it('should fail when to is not valid', function(done) {
            testFail(done, payload.test1, 'to', 'Not Found');
        });

        // test 2
        it('should fail when status is invalid', function (done) {
            testFail(done, payload.test2, 'status', 'Invalid');
        });

        // test 3
        it('should fail when status is deleted', function (done) {
            testFail(done, payload.test3, 'status', 'Invalid');
        });

        // test 4
        it('should fail when status is accepted', function(done) {
            testFail(done, payload.test4, 'status', 'Invalid');
        });

        // test 5
        it('should fail when admin passes in non created user', function(done) {
            testFail(done, payload.test5, 'from', 'Not Found');
        });

        // test 6
        it('should return success', function(done) {
            var test = payload.test6;
            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);
            checkData(test, 'from', credentials.id);
            checkData(test, 'to', testUserCredentials.id);
            checkDataStatus(test, 'pending');

            done( );
        });

        // test 7
        it('should not create a new friendship upon double request', function(done) {
            var test = payload.test7;
            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);
            checkData(test, 'id', userFriends.id);
            checkData(test, 'createdOn', userFriends.createdOn);
            checkData(test, 'from', credentials.id);
            checkData(test, 'to', testUserCredentials.id);
            checkDataStatus(test, 'pending');
            done( );
        });

        // test 8
        it('should not create a new friendship upon request of to to from', function(done) {
            var test = payload.test8;
            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);
            checkData(test, 'id', userFriends.id);
            checkData(test, 'createdOn', userFriends.createdOn);
            //from should still be knownAdmin
            checkData(test, 'from', credentials.id);
            // to should still be test user
            checkData(test, 'to', testUserCredentials.id);
            checkDataStatus(test, 'pending');

            done( );
        });

        // test 9
        it('Admin is able to create friends between two other users', function(done) {
            var test = payload.test9;
            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);
            checkData(test, 'from', dummyUser1.id);
            checkData(test, 'to', dummyUser2.id);
            checkDataStatus(test, 'blocked');

            done( );
        });

        // test 10
        it('Normal user is able to create friends between self and other user', function(done) {
            var test = payload.test10;
            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);
            checkData(test, 'from', testUserCredentials.id);
            checkData(test, 'to', dummyUser1.id);
            checkDataStatus(test, 'pending');

            done( );
        });
    });

    describe('/:id/get', function( ) {
        var method = '/get';
        var payload = { };

        before(function(done) {
            async.series([
                // normal user (from) getting friend
                function(callback) {
                    utils.get(rootUrl, '/' + userFriends.toToDummyID + method, addAuth({ }, true), function(err, result) {
                        if (err) return callback(err);
                        payload.normUserFrom = result;
                        callback( );
                    });
                },

                // normal user (to) getting friend
                function(callback) {
                    utils.get(rootUrl, '/' + userFriends.id + method, addAuth({ }, true), function(err, result) {
                        if (err) return callback(err);
                        payload.normUserTo = result;
                        callback( );
                    });
                },

                // normal user (neither) getting friend (should fail)
                function(callback) {
                    utils.get(rootUrl, '/' + userFriends.dummyToDummyID + method, addAuth({ }, true), function(err, result) {
                        if (err) return callback(err);
                        payload.normUserNeither = result;
                        callback( );
                    });
                },

                // admin user getting friend
                function(callback) {
                    utils.get(rootUrl, '/' + userFriends.id + method, addAuth({ }), function(err, result) {
                        if (err) return callback(err);
                        payload.adminUserOne = result;
                        callback( );
                    });
                },

                // admin user getting friends of two others (neither to or from)
                function(callback) {
                    utils.get(rootUrl, '/' + userFriends.dummyToDummyID + method, addAuth({ }), function(err, result) {
                        if (err) return callback(err);
                        payload.adminUserNeither = result;
                        callback( );
                    });
                }

            ], function(err) {
                done( );
            });
        });

        it('normal user should be able to get own friend when it is from', function(done) {
            var test = payload.normUserFrom;

            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);
            checkData(test, 'id', userFriends.toToDummyID);
            checkData(test, 'createdOn', userFriends.toToDummyOn);
            checkData(test, 'from', testUserCredentials.id);
            checkData(test, 'to', dummyUser1.id);

            // don't care what status is (must be one of valid options though)
            checkDataStatus(test);

            done( );
        });

        it('normal user should be able to get own friend when it is to', function(done) {
            var test = payload.normUserTo;

            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);
            checkData(test, 'id', userFriends.id);
            checkData(test, 'createdOn', userFriends.createdOn);
            checkData(test, 'from', credentials.id);
            checkData(test, 'to', testUserCredentials.id);

            // don't care what status is (must be one of valid options though)
            checkDataStatus(test);

            done( );
        });

        it('normal user should not be able to get friend info if it is not to or from', function(done) {
            testFail(done, payload.normUserNeither, 'id', 'Forbidden');
        });

        it('admin user should be able to get friend info of its own', function(done) {
            var test = payload.adminUserOne;

            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);
            checkData(test, 'id', userFriends.id);
            checkData(test, 'createdOn', userFriends.createdOn);
            checkData(test, 'from', credentials.id);
            checkData(test, 'to', testUserCredentials.id);

            // don't care what status is (must be one of valid options though)
            checkDataStatus(test);

            done( );
        });

        it('admin user should be able to get friend info where it is not to or from', function(done) {
            var test = payload.adminUserNeither;

            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);
            checkData(test, 'id', userFriends.dummyToDummyID);
            checkData(test, 'createdOn', userFriends.dummyToDummyOn);
            checkData(test, 'from', dummyUser1.id);
            checkData(test, 'to', dummyUser2.id);

            // don't care what status is (must be one of valid options though)
            checkDataStatus(test);

            done( );
        });
    });

    describe('/find/:userA/:userB', function( ) {
        var method = '/find';
        var payload = { };

        before(function(done) {
            async.series([

                // normal user as b and other a (valid test)
                function(callback) {
                    utils.get(rootUrl, method + '/' + dummyUser1.id +'/' + testUserCredentials.id, addAuth({ }, true), function(err, result) {
                        if (err) return callback(err);
                        payload.normUserB = result;
                        callback( );
                    });
                },

                // normal user as b (using default) and other a (valid test)
                function(callback) {
                    utils.get(rootUrl, method + '/' + dummyUser1.id + '/', addAuth({ }, true), function(err, result) {
                        if (err) return callback(err);
                        payload.normUserBDefault = result;
                        callback( );
                    });
                },

                // normal user pass same value for A and B
                function(callback) {
                    utils.get(rootUrl, method + '/' + testUserCredentials.id + '/' + testUserCredentials.id, addAuth({ }, true), function(err, result) {
                        if (err) return callback(err);
                        payload.normUserABSame = result;
                        callback( );
                    });
                },

                // normal user as b and non relation for a
                function(callback) {
                    utils.get(rootUrl, method + '/' + dummyUser2.id + '/' + testUserCredentials.id, addAuth({ }, true), function(err, result) {
                        if (err) return callback(err);
                        payload.normUserNonRelation = result;
                        callback( );
                    });
                },

                // normal user pass another user as b
                function(callback) {
                    utils.get(rootUrl, method + '/' + dummyUser2.id + '/' + dummyUser1.id, addAuth({ }, true), function(err, result) {
                        if (err) return callback(err);
                        payload.normUserNotB = result;
                        callback( );
                    });
                },

                // admin user as b and other user for a
                function(callback) {
                    utils.get(rootUrl, method + '/' + testUserCredentials.id + '/' + credentials.id, addAuth({ }), function(err, result) {
                        if (err) return callback(err);
                        payload.adminUserB = result;
                        callback( );
                    });
                },

                // admin user as a and other user for b
                function(callback) {
                    utils.get(rootUrl, method + '/' + credentials.id + '/' + testUserCredentials.id, addAuth({ }), function(err, result) {
                        if (err) return callback(err);
                        payload.adminUserA = result;
                        callback( );
                    });
                },

                // admin user neither a or b
                function(callback) {
                    utils.get(rootUrl, method + '/' + dummyUser1.id + '/' + testUserCredentials.id, addAuth({ }), function(err, result) {
                        if (err) return callback(err);
                        payload.adminUserNeither = result;
                        callback( );
                    });
                },

                // admin user as neither, but no relation from a to b
                function(callback) {
                    utils.get(rootUrl, method + '/' + dummyUser2.id + '/' + testUserCredentials.id, addAuth({ }), function(err, result) {
                        if (err) return callback(err);
                        payload.adminUserNoRelation = result;
                        callback( );
                    });
                },

                // admin user pass same value for A and B
                function(callback) {
                    utils.get(rootUrl, method + '/' + testUserCredentials.id + '/' + testUserCredentials.id, addAuth({ }), function(err, result) {
                        if (err) return callback(err);
                        payload.adminUserABSame = result;
                        callback( );
                    });
                }
            ], function(err) {
                done( );
            });
        });

        // normal user as b and other a (valid test)
        it('should pass when normal user as b and valid friend for a', function(done) {
            var test = payload.normUserB;

            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);
            checkData(test, 'id', userFriends.toToDummyID);
            checkData(test, 'createdOn', userFriends.toToDummyOn);
            checkData(test, 'from', testUserCredentials.id);
            checkData(test, 'to', dummyUser1.id);

            // don't care what status is (must be one of valid options though)
            checkDataStatus(test);

            done( );
        });

        // normal user as b (using default) and other a (valid test)
        it('should pass when normal user using default for b and valid friend for a', function(done) {
            var test = payload.normUserBDefault;

            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);

            checkData(test, 'id', userFriends.toToDummyID);
            checkData(test, 'createdOn', userFriends.toToDummyOn);
            checkData(test, 'from', testUserCredentials.id);
            checkData(test, 'to', dummyUser1.id);

            // don't care what status is (must be one of valid options though)
            checkDataStatus(test);

            done( );
        });

        // normal user pass same value for A and B
        it('should fail if same values passed for A and B', function(done) {
            testFail(done, payload.normUserABSame, 'reason', 'userA and userB are the same');
        });

        // normal user as b and non relation for a
        it('should fail if normal user is not in relation with a', function(done) {
            testFail(done, payload.normUserNonRelation, 'userA', 'Is not a friend of userB');
        });

        // normal user pass another user as b
        it('should fail if normal user passes in different user for b', function(done) {
            testFail(done, payload.normUserNotB, 'id', 'Forbidden');
        });

        // admin user as b and other user for a
        it('should pass when admin as b and other valid user as a', function(done) {
            var test = payload.adminUserB;

            shouldReturnSuccess(test)
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);;
            checkData(test, 'id', userFriends.id);
            checkData(test, 'createdOn', userFriends.createdOn);
            checkData(test, 'from', credentials.id);
            checkData(test, 'to', testUserCredentials.id);

            // don't care what status is (must be one of valid options though)
            checkDataStatus(test);

            done( );
        });

        // admin user as a and other user for b
        it('should pass when admin as a and other valid user as b', function(done) {
            var test = payload.adminUserA;

            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);
            checkData(test, 'id', userFriends.id);
            checkData(test, 'createdOn', userFriends.createdOn);
            checkData(test, 'from', credentials.id);
            checkData(test, 'to', testUserCredentials.id);

            // don't care what status is (must be one of valid options though)
            checkDataStatus(test);

            done( );
        });

        // admin user neither a or b
        it('should pass when admin enters in valid friends not involving self', function(done) {
            var test = payload.adminUserNeither;

            shouldReturnSuccess(test);
            test.data.should.have.properties(['id', 'createdOn', 'from','to', 'status']);
            checkData(test, 'id', userFriends.toToDummyID);
            checkData(test, 'createdOn', userFriends.toToDummyOn);
            checkData(test, 'from', testUserCredentials.id);
            checkData(test, 'to', dummyUser1.id);

            // don't care what status is (must be one of valid options though)
            checkDataStatus(test);

            done( );
        });

        // admin user as neither, but no relation from a to b
        it('should fail if userA is not in relation with userB', function(done) {
            testFail(done, payload.adminUserNoRelation, 'userA', 'Is not a friend of userB');
        });

        // admin user pass same value for A and B
        it('should fail if admin pass same values passed for A and B', function(done) {
            testFail(done, payload.adminUserABSame, 'reason', 'userA and userB are the same');
        });

    });

    describe('/:id/list/:status', function( ) {
        var method = '/list';
        var payload = { };

        var objToTest = { };

        before(function(done) {
            objToTest.id = userFriends.id;
            objToTest.createdOn = userFriends.createdOn;
            objToTest.from = credentials.id;
            objToTest.to = testUserCredentials.id;
            status = 'pending';

            async.series([

                // test normal user not passing self (fail)
                function(callback) {
                    utils.get(rootUrl, '/' + dummyUser1.id + method + '/pending', addAuth({ }, true), function(err, result) {
                        if (err) return callback(err);
                        payload.normUserNot = result;
                        callback( );
                    });
                },

                // test normal user passing in invalid status (not accepted, blocked, pending, or deleted) (fail)
                function(callback) {
                    utils.get(rootUrl, '/' + testUserCredentials.id + method + '/invalidStatus', addAuth({ }, true), function(err, result) {
                        if (err) return callback(err);
                        payload.normUserInvalidStatus = result;
                        callback( );
                    });
                },

                // test normal user passing nothing for status (should pass and default to all statuses)
                function(callback) {
                    utils.get(rootUrl, '/' + testUserCredentials.id + method, addAuth({ }, true), function(err, result) {
                        if (err) return callback(err);
                        payload.normUserDefaultStatus = result;

                        if (!payload.normUserDefaultStatus.data)
                            payload.normUserDefaultStatus.data = { friends: payload.normUserDefaultStatus.friends };

                        callback( );
                    });
                },

                // test admin user passing self (pass)
                function(callback) {
                    utils.get(rootUrl, '/' + credentials.id + method + '/pending', addAuth({ }), function(err, result) {
                        if (err) return callback(err);
                        payload.adminUserSelf = result;

                        if (!payload.adminUserSelf.data)
                            payload.adminUserSelf.data = { friends: payload.adminUserSelf.friends };

                        callback( );
                    });
                },

                // test admin user not passing self (pass)
                function(callback) {
                    utils.get(rootUrl, '/' + testUserCredentials.id + method, addAuth({ }), function(err, result) {
                        if (err) return callback(err);
                        payload.adminUserOther = result;

                        if (!payload.adminUserOther.data)
                            payload.adminUserOther.data = { friends: payload.adminUserOther.friends };

                        callback( );
                    });
                },

                // test admin passing in invalid status (not accepted, blocked, pending, or deleted) (fail)
                function(callback) {
                    utils.get(rootUrl, '/' + credentials.id + method + '/InvalidStatus', addAuth({ }), function(err, result) {
                        if (err) return callback(err);

                        payload.adminUserInvalidStatus = result;

                        callback( );
                    });
                },

            ], function(err) {
                done( );
            });
        });

        // test normal user not passing self (fail)
        it('should fail when normal user does not pass self', function(done) {
            testFail(done, payload.normUserNot, 'userid', 'Forbidden');
        });

        // test normal user passing in invalid status (not accepted, blocked, pending, or deleted) (fail)
        it('should fail when user passes in invaild status', function(done) {
            testFail(done, payload.normUserInvalidStatus, 'status', 'Invalid');
        });

        function checkList(test, objToTest) {
            shouldReturnSuccess(test);
            test.data.should.have.property('friends');
            test.data.friends.should.be.Array( );

            var index = { };

            for (var i = 0; i < test.data.friends.length; i++) {
                index[test.data.friends[i].id] = test.data.friends[i];
            }

            var known = index[objToTest.id];

            for (var property in objToTest) {
                known.should.have.property(property);

                if (typeof objToTest[property] === 'object') {
                    for (var subproperty in objToTest[property]) {
                        known[property].should.have.property(subproperty);
                        known[property][subproperty].toString().should.equal(objToTest[property][subproperty].toString());
                    }
                }
                else {
                    known[property].toString().should.equal(objToTest[property].toString());
                }
            }
        }



        // test normal user passing nothing for status (should pass and default to all statuses)
        it('should pass when nothing passed for status', function(done) {
            var test = payload.normUserDefaultStatus;

            checkList(test, objToTest);

            done( );
        });

        // test admin user passing self (pass)
        it('should pass when admin passes self', function(done) {
            var test = payload.adminUserSelf;

            checkList(test, objToTest);

            done( );
        });

        // test admin user not passing self (pass)
        it('should pass when admin pass other', function(done) {
            var test = payload.adminUserOther;

            checkList(test, objToTest);

            done( );
        });

        // test admin passing in invalid status (not accepted, blocked, pending, or deleted) (fail)
        it('should fail when admin passes invalid status', function(done) {
            testFail(done, payload.adminUserInvalidStatus, 'status', 'Invalid');
        });

    });

    describe('/:id/update', function( ) {
        var method = '/update';
        var payload = {};

        before(function (done) {

            var body = {
                status: 'INVALID'
            };

            async.series([
                // test invalid status ( fails )
                function(callback) {
                    utils.post(rootUrl, '/' + userFriends.id + method, addAuth(body, true), function (err, result) {
                        if (err) return callback(err);

                        payload.InvalidStatus = result;
                        callback( );
                    });
                },

                // test invalid id ( fails )
                function(callback) {
                    body.status = 'accepted';

                    var invalidID = 12321;  // will never have more than 1000 in this class

                    utils.post(rootUrl, '/' + invalidID + method, addAuth(body, true), function (err, result) {
                        if (err) return callback(err);

                        payload.InvalidID = result;
                        callback( );
                    });
                },

                // test norm user with id that it is not involved in ( fails )
                function(callback) {
                    utils.post(rootUrl, '/' + userFriends.dummyToDummyID + method, addAuth(body, true), function (err, result) {
                        if (err) return callback(err);

                        payload.normUserNotInvolved = result;
                        callback( );
                    });
                },

                // test norm user (from) changing to accepted
                function(callback) {
                    utils.post(rootUrl, '/' + userFriends.toToDummyID + method, addAuth(body, true), function (err, result) {
                        if (err) return callback(err);

                        payload.normFromAccepted = result;
                        callback( );
                    });
                },
                // test norm user changing to blocked
                function(callback) {
                    body.status = 'blocked';
                    utils.post(rootUrl, '/' + userFriends.id + method, addAuth(body, true), function (err, result) {
                        if (err) return callback(err);

                        payload.normPendToBlock = result;
                        callback( );
                    });
                },

                // test norm user changing out of blocked
                function(callback) {
                    body.status = 'pending';
                    utils.post(rootUrl, '/' + userFriends.id + method, addAuth(body, true), function (err, result) {
                        if (err) return callback(err);

                        payload.normBlockToPend = result;
                        callback( );
                    });
                },

                // test admin changing out of blocked
                function(callback) {
                    utils.post(rootUrl, '/' + userFriends.id + method, addAuth(body), function (err, result) {
                        if (err) return callback(err);

                        payload.adminBlockToPend = result;
                        callback( );
                    });
                },

                // test admin not involved
                function(callback) {
                    body.status = 'deleted';

                    utils.post(rootUrl, '/' + userFriends.dummyToDummyID + method, addAuth(body), function (err, result) {
                        if (err) return callback(err);

                        payload.adminNotInvolved = result;
                        callback( );
                    });
                },



            ], function (err) {
                done();
            });
        });

        // test invalid status ( fails )
        it('should fail when given invalid status', function(done) {
            testFail(done, payload.InvalidStatus, 'status', 'Invalid');
        });

        // test invalid id ( fails )
        it('should fail when given an invalid id', function(done) {
            testFail(done, payload.InvalidID, 'id', 'Forbidden');
        });

        // test norm user with id that it is not involved in ( fails )
        it('should fail when normal user gives id that not involved in', function(done) {
            testFail(done, payload.normUserNotInvolved, 'id', 'Forbidden');
        });

        // test norm user (from) changing to accepted
        it('from normal user should not change pending to accepted', function(done) {
           var test = payload.normFromAccepted;

            shouldReturnSuccess(test);

            test.data.should.have.property('id');
            test.data.id.should.equal(userFriends.toToDummyID);

            test.data.should.not.have.property('status');

            done( );
        });

        // test norm user changing to blocked
        it('should change to blocked', function(done) {
            var test = payload.normPendToBlock;

            shouldReturnSuccess(test);

            test.data.should.have.property('id');
            test.data.id.should.equal(userFriends.id);

            checkDataStatus(test, 'blocked');

            done( );
        });

        // test norm user changing out of blocked
        it('normal user should not be able to change out of blocked', function(done) {
            var test = payload.normBlockToPend;

            shouldReturnSuccess(test);

            checkData(test, 'id', userFriends.id)

            // should not all change
            test.data.should.not.have.property('status');

            done( );
        });

        // test admin changing out of blocked
        it('admin user should be able to change out of blocked', function(done) {
            var test = payload.adminBlockToPend;

            shouldReturnSuccess(test);

            checkData(test, 'id', userFriends.id)

            checkDataStatus(test, 'pending');

            done( );
        });

        // test admin not involved
        it('admin user should be able to change friend it is not involved in', function(done) {
            var test = payload.adminNotInvolved;

            shouldReturnSuccess(test);

            checkData(test, 'id', userFriends.dummyToDummyID)

            checkDataStatus(test, 'deleted');

            done( );
        });
    });
});


