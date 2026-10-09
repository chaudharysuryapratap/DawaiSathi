/* global __dirname */
const assert=require('node:assert/strict'),path=require('node:path'),test=require('node:test'),babel=require('@babel/core');
test('typography plugin covers application text but leaves icons, native dependencies and primitives alone',()=>{
  const plugin=require('./app-typography-plugin.cjs');
  const source="import { Text, TextInput, View } from 'react-native';";
  const compile=file=>babel.transformSync(source,{filename:path.resolve(__dirname,'../'+file),configFile:false,babelrc:false,plugins:[plugin]}).code;
  assert.ok(compile('app/(tabs)/settings.tsx').includes('@/src/components/ui/app-typography'));
  assert.ok(compile('src/components/app-header.tsx').includes('@/src/components/ui/app-typography'));
  assert.ok(!compile('node_modules/icons/index.js').includes('@/src/components/ui/app-typography'));
  assert.ok(!compile('src/components/ui/app-typography.tsx').includes('@/src/components/ui/app-typography'));
});
