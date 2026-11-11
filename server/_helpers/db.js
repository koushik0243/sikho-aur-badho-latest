import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

// Tune the driver's connection pool so concurrent requests reuse warm sockets
// instead of queuing behind a small default pool or paying handshake cost.
// - maxPoolSize: raise ceiling for concurrent in-flight queries per process.
// - minPoolSize: keep a few sockets warm so the first requests after idle
//   periods don't pay connection-setup latency.
// - autoIndex: index builds on every model registration are useful in dev but
//   cost startup time in prod; skip them there (indexes are still created by
//   _helpers/rebuildIndexes.js / migrations, not on the request path either way).
mongoose.connect(process.env.MONGO_DB_URI, {
    maxPoolSize: 50,
    minPoolSize: 5,
    autoIndex: process.env.NODE_ENV !== 'production',
})
.then(async () => {
    console.log("Successfully connected to MongoDB");

    // // Drop stale non-partial unique index on roles.name (if it exists) and
    // // let Mongoose recreate it correctly as a partial index (deletedAt: null).
    // // This fixes E11000 errors that occur when soft-deleted roles share a name
    // // with an active role.
    // try {
    //     const rolesCollection = mongoose.connection.db.collection('roles');
    //     const indexes = await rolesCollection.indexes();
    //     const stale = indexes.find(
    //         idx => idx.name === 'name_1' && !idx.partialFilterExpression
    //     );
    //     if (stale) {
    //         await rolesCollection.dropIndex('name_1');
    //         console.log('roles: dropped stale non-partial name_1 index');
    //     }
    //     // Recreate the correct partial unique index via Mongoose
    //     const Role = mongoose.model('Role');
    //     await Role.syncIndexes();
    //     console.log('roles: indexes synced');
    // } catch (err) {
    //     console.error('roles: index sync failed —', err.message);
    // }
})
.catch((err) => {
    console.error("Error connecting to MongoDB:", err);
});
