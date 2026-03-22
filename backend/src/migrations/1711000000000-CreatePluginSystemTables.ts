import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreatePluginSystemTables1711000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'plugin_package',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'pluginKey', type: 'varchar' },
          { name: 'name', type: 'varchar' },
          { name: 'version', type: 'varchar' },
          { name: 'author', type: 'varchar', isNullable: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'appCompatibility', type: 'varchar' },
          { name: 'capabilities', type: 'jsonb', default: "'[]'::jsonb" },
          { name: 'manifestJson', type: 'jsonb' },
          { name: 'bundleJson', type: 'jsonb', isNullable: true },
          { name: 'approvalStatus', type: 'varchar', default: "'APPROVED'" },
          { name: 'approvalSource', type: 'varchar', isNullable: true },
          { name: 'checksum', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
        uniques: [{ columnNames: ['pluginKey', 'version'] }],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'plugin_install',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'pluginPackageId', type: 'int' },
          { name: 'pluginKey', type: 'varchar' },
          { name: 'version', type: 'varchar' },
          { name: 'status', type: 'varchar', default: "'ENABLED'" },
          { name: 'installPolicy', type: 'jsonb', isNullable: true },
          { name: 'uninstallPolicy', type: 'jsonb', isNullable: true },
          { name: 'settingsSchema', type: 'jsonb', isNullable: true },
          { name: 'settingsValues', type: 'jsonb', isNullable: true },
          { name: 'archivedConfig', type: 'jsonb', isNullable: true },
          { name: 'installedById', type: 'int', isNullable: true },
          { name: 'enabledAt', type: 'timestamp', isNullable: true },
          { name: 'disabledAt', type: 'timestamp', isNullable: true },
          { name: 'uninstalledAt', type: 'timestamp', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
    );

    await this.createDefinitionTable(queryRunner, 'plugin_permission', [
      { name: 'permissionCode', type: 'varchar' },
      { name: 'permissionName', type: 'varchar' },
      { name: 'moduleName', type: 'varchar' },
      { name: 'scopeLevel', type: 'varchar', default: "'PROJECT'" },
      { name: 'description', type: 'text', isNullable: true },
    ]);
    await this.createDefinitionTable(queryRunner, 'plugin_menu', [
      { name: 'menuKey', type: 'varchar' },
      { name: 'label', type: 'varchar' },
      { name: 'location', type: 'varchar', default: "'SIDEBAR'" },
      { name: 'pageKey', type: 'varchar', isNullable: true },
      { name: 'pathTemplate', type: 'varchar', isNullable: true },
      { name: 'icon', type: 'varchar', isNullable: true },
      { name: 'permissionCode', type: 'varchar', isNullable: true },
      { name: 'requiresProject', type: 'boolean', default: false },
      { name: 'sortOrder', type: 'int', default: 0 },
      { name: 'config', type: 'jsonb', isNullable: true },
    ]);
    await this.createDefinitionTable(queryRunner, 'plugin_page', [
      { name: 'pageKey', type: 'varchar' },
      { name: 'title', type: 'varchar' },
      { name: 'rendererType', type: 'varchar' },
      { name: 'routePath', type: 'varchar', isNullable: true },
      { name: 'permissionCode', type: 'varchar', isNullable: true },
      { name: 'sortOrder', type: 'int', default: 0 },
      { name: 'config', type: 'jsonb', isNullable: true },
    ]);
    await this.createDefinitionTable(queryRunner, 'plugin_widget', [
      { name: 'widgetKey', type: 'varchar' },
      { name: 'title', type: 'varchar' },
      { name: 'widgetType', type: 'varchar' },
      { name: 'permissionCode', type: 'varchar', isNullable: true },
      { name: 'sortOrder', type: 'int', default: 0 },
      { name: 'config', type: 'jsonb', isNullable: true },
    ]);
    await this.createDefinitionTable(queryRunner, 'plugin_report', [
      { name: 'reportKey', type: 'varchar' },
      { name: 'title', type: 'varchar' },
      { name: 'permissionCode', type: 'varchar', isNullable: true },
      { name: 'exportTypes', type: 'jsonb', default: "'[]'::jsonb" },
      { name: 'dataSourceKey', type: 'varchar', isNullable: true },
      { name: 'sortOrder', type: 'int', default: 0 },
      { name: 'config', type: 'jsonb', isNullable: true },
    ]);
    await this.createDefinitionTable(queryRunner, 'plugin_workflow', [
      { name: 'workflowKey', type: 'varchar' },
      { name: 'processCode', type: 'varchar' },
      { name: 'moduleCode', type: 'varchar' },
      { name: 'permissionCode', type: 'varchar', isNullable: true },
      { name: 'isActive', type: 'boolean', default: true },
      { name: 'sortOrder', type: 'int', default: 0 },
      { name: 'config', type: 'jsonb', isNullable: true },
    ]);
    await this.createDefinitionTable(queryRunner, 'plugin_setting', [
      { name: 'settingKey', type: 'varchar' },
      { name: 'label', type: 'varchar' },
      { name: 'fieldType', type: 'varchar' },
      { name: 'required', type: 'boolean', default: false },
      { name: 'defaultValue', type: 'jsonb', isNullable: true },
      { name: 'config', type: 'jsonb', isNullable: true },
      { name: 'sortOrder', type: 'int', default: 0 },
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'plugin_audit_log',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'pluginKey', type: 'varchar' },
          { name: 'action', type: 'varchar' },
          { name: 'actorUserId', type: 'int', isNullable: true },
          { name: 'pluginInstallId', type: 'int', isNullable: true },
          { name: 'details', type: 'jsonb', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'plugin_install',
      new TableForeignKey({
        columnNames: ['pluginPackageId'],
        referencedTableName: 'plugin_package',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'plugin_install',
      new TableForeignKey({
        columnNames: ['installedById'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    for (const table of [
      'plugin_permission',
      'plugin_menu',
      'plugin_page',
      'plugin_widget',
      'plugin_report',
      'plugin_workflow',
      'plugin_setting',
    ]) {
      await queryRunner.createForeignKey(
        table,
        new TableForeignKey({
          columnNames: ['pluginInstallId'],
          referencedTableName: 'plugin_install',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    await queryRunner.createForeignKey(
      'plugin_audit_log',
      new TableForeignKey({
        columnNames: ['pluginInstallId'],
        referencedTableName: 'plugin_install',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'plugin_install',
      new TableIndex({
        name: 'IDX_plugin_install_pluginKey_status',
        columnNames: ['pluginKey', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'plugin_audit_log',
      'plugin_setting',
      'plugin_workflow',
      'plugin_report',
      'plugin_widget',
      'plugin_page',
      'plugin_menu',
      'plugin_permission',
      'plugin_install',
      'plugin_package',
    ]) {
      await queryRunner.dropTable(table, true);
    }
  }

  private async createDefinitionTable(
    queryRunner: QueryRunner,
    name: string,
    extraColumns: any[],
  ) {
    await queryRunner.createTable(
      new Table({
        name,
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'pluginInstallId', type: 'int' },
          ...extraColumns,
        ],
      }),
    );
  }
}
