import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import Role from '../roles/role.model.js';
import Permission from '../permissions/permission.model.js';

const rebuildIndexes = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);

        console.log('Rebuilding Role indexes...');
        await Role.collection.dropIndexes();
        await Role.collection.createIndexes();
        console.log('✓ Role indexes rebuilt');

        console.log('Rebuilding Permission indexes...');
        await Permission.collection.dropIndexes();
        await Permission.collection.createIndexes();
        console.log('✓ Permission indexes rebuilt');

        console.log('\n✓ All indexes rebuilt successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error rebuilding indexes:', error.message);
        process.exit(1);
    }
};

rebuildIndexes();
