const { Plugin, Modal, Notice, TFolder } = require('obsidian');

class AutoFolderCreator extends Plugin {
    async onload() {
        // Add ribbon icon
        this.addRibbonIcon('folder-plus', 'Auto Folder Creator', () => {
            this.showFileCreatorModal();
        });

        // Add command to command palette
        this.addCommand({
            id: 'open-auto-folder-creator',
            name: 'Create New File with Folders',
            callback: () => {
                this.showFileCreatorModal();
            }
        });
    }

    showFileCreatorModal() {
        const modal = new FileCreatorModal(this.app);
        modal.open();
    }
}

class FileCreatorModal extends Modal {
    constructor(app) {
        super(app);
        this.levels = {
            first: '',
            second: '',
            third: ''
        };
        this.fileName = '';
        this.secondLevelSelect = null;
        this.thirdLevelSelect = null;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: 'Create New File' });

        // File name input
        const fileNameContainer = contentEl.createDiv();
        fileNameContainer.createEl('label', { text: 'File Name: ' });
        const fileNameInput = fileNameContainer.createEl('input', {
            type: 'text',
            placeholder: 'Enter file name (without .md)'
        });
        fileNameInput.addEventListener('input', (e) => {
            this.fileName = e.target.value;
        });

        // First level folder
        const firstLevelContainer = contentEl.createDiv();
        const firstLevelSelect = await this.createFolderSelector(
            firstLevelContainer, 
            'First Level Folder:', 
            'first', 
            null, 
            () => this.updateSecondLevelFolders()
        );

        // Second level folder
        const secondLevelContainer = contentEl.createDiv();
        this.secondLevelSelect = await this.createFolderSelector(
            secondLevelContainer, 
            'Second Level Folder (Optional):', 
            'second', 
            'first', 
            () => this.updateThirdLevelFolders()
        );

        // Third level folder
        const thirdLevelContainer = contentEl.createDiv();
        this.thirdLevelSelect = await this.createFolderSelector(
            thirdLevelContainer, 
            'Third Level Folder (Optional):', 
            'third', 
            'second'
        );

        // Create button
        const createButton = contentEl.createEl('button', {
            text: 'Create File',
            cls: 'mod-cta'
        });
        createButton.addEventListener('click', () => this.createFile());
    }

    async createFolderSelector(container, labelText, level, dependentLevel = null, onChangeCallback = null) {
        container.createEl('label', { text: labelText });
        
        const inputContainer = container.createDiv({ cls: 'input-container' });
        
        const select = inputContainer.createEl('select');
        select.createEl('option', { text: 'Select existing folder', value: '' });
        
        const input = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Or enter new folder name'
        });

        // Populate first-level folders
        if (level === 'first') {
            const folders = await this.getFirstLevelFolders();
            folders.forEach(folder => {
                select.createEl('option', { text: folder, value: folder });
            });
        }

        select.addEventListener('change', (e) => {
            if (e.target.value) {
                input.value = '';
                this.levels[level] = e.target.value;
                if (onChangeCallback) onChangeCallback();
            }
        });

        input.addEventListener('input', (e) => {
            if (e.target.value) {
                select.value = '';
                this.levels[level] = e.target.value;
                if (onChangeCallback) onChangeCallback();
            }
        });

        if (dependentLevel) {
            select.disabled = true;
        }

        return select;
    }

    async getFirstLevelFolders() {
        const files = this.app.vault.getAllLoadedFiles();
        const folders = new Set();

        files.forEach(file => {
            if (file instanceof TFolder && file.path !== '.obsidian') {
                const parts = file.path.split('/');
                if (parts.length === 1) {
                    folders.add(file.name);
                }
            }
        });

        return Array.from(folders).sort();
    }

    async updateSecondLevelFolders() {
        if (!this.secondLevelSelect) return;

        this.secondLevelSelect.innerHTML = '';
        this.secondLevelSelect.createEl('option', { text: 'Select existing folder', value: '' });

        if (!this.levels.first) {
            this.secondLevelSelect.disabled = true;
            return;
        }

        const folders = await this.getSubfolders('second');
        
        if (folders.length > 0) {
            this.secondLevelSelect.disabled = false;
            folders.forEach(folder => {
                this.secondLevelSelect.createEl('option', { text: folder, value: folder });
            });
        } else {
            this.secondLevelSelect.disabled = true;
        }
    }

    async updateThirdLevelFolders() {
        if (!this.thirdLevelSelect) return;

        this.thirdLevelSelect.innerHTML = '';
        this.thirdLevelSelect.createEl('option', { text: 'Select existing folder', value: '' });

        if (!this.levels.first || !this.levels.second) {
            this.thirdLevelSelect.disabled = true;
            return;
        }

        const folders = await this.getSubfolders('third');
        
        if (folders.length > 0) {
            this.thirdLevelSelect.disabled = false;
            folders.forEach(folder => {
                this.thirdLevelSelect.createEl('option', { text: folder, value: folder });
            });
        } else {
            this.thirdLevelSelect.disabled = true;
        }
    }

    async getSubfolders(level) {
        const files = this.app.vault.getAllLoadedFiles();
        const folders = new Set();

        files.forEach(file => {
            if (file instanceof TFolder) {
                const parts = file.path.split('/').filter(p => p);
                
                if (level === 'second' && 
                    parts[0] === this.levels.first && 
                    parts.length === 2) {
                    folders.add(parts[1]);
                } else if (level === 'third' && 
                           parts[0] === this.levels.first && 
                           parts[1] === this.levels.second && 
                           parts.length === 3) {
                    folders.add(parts[2]);
                }
            }
        });

        return Array.from(folders).sort();
    }

    async createFile() {
        if (!this.fileName) {
            new Notice('Please enter a file name');
            return;
        }

        try {
            // Construct the full path
            let path = [];
            if (this.levels.first) path.push(this.levels.first);
            if (this.levels.second) path.push(this.levels.second);
            if (this.levels.third) path.push(this.levels.third);
            path.push(this.fileName + '.md');
            
            const fullPath = path.join('/');

            // Create necessary folders
            for (let i = 1; i <= path.length - 1; i++) {
                const folderPath = path.slice(0, i).join('/');
                if (!(await this.app.vault.adapter.exists(folderPath))) {
                    await this.app.vault.createFolder(folderPath);
                }
            }

            // Create and open the file
            const file = await this.app.vault.create(fullPath, '');
            const leaf = this.app.workspace.getUnpinnedLeaf();
            await leaf.openFile(file);

            this.close();
            new Notice(`File created: ${fullPath}`);
        } catch (error) {
            new Notice('Error creating file: ' + error.message);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

module.exports = AutoFolderCreator;

