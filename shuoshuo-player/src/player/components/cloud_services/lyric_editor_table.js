import React, {useCallback, useMemo} from 'react';
import {
    TableContainer, Table, TableHead, TableRow, TableCell,
    Checkbox, TableBody, Input, IconButton, Typography
} from '@mui/material';
import {noop} from 'lodash';
import PropTypes from "prop-types";
import CheckIcon from '@mui/icons-material/Check';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import {createLyricsFinder, formatTimeLyric} from "@/utils";

const LyricEditorTable = (props) => {
    const {
        lyrics = [],
        selectedRows = [],
        readonly = false,
        onUpdate = noop,
        onSelectChange = noop,
        currentPlaying = 0,
    } = props;
    const [editingRow, setEditingRow] = React.useState(null);
    const [editingRowIndex, setEditingRowIndex] = React.useState(-1);

    // === 歌词计算
    const lrcDurationFinder = useMemo(() => {
        if (lyrics.length <= 0) return null;
        return createLyricsFinder(lyrics, 0)
    }, [lyrics]);

    // 获取当前歌词高亮位置
    const currentLrc = useMemo(() => {
        if (lrcDurationFinder) {
            return lrcDurationFinder(currentPlaying)
        }
        return null;
    }, [lrcDurationFinder, currentPlaying]);

    // 编辑状态判断
    const isEditing = useMemo(() => {
        if (readonly) return false;
        return editingRowIndex > -1;
    }, [readonly, editingRowIndex]);

    // 行选择事件处理
    const handleSelectLine = useCallback((e, rowIndex) => {
        if (isEditing) return;
        let ret = [...selectedRows];
        if (e.target.checked) {
            ret.push(rowIndex)
        } else {
            ret.splice(ret.indexOf(rowIndex), 1);
        }
        onSelectChange(ret);
    }, [isEditing, selectedRows, onSelectChange])

    // 全选行事件处理
    const handleSelectAllLine = useCallback(() => {
        if (isEditing) return;
        let ret = lyrics.map((item, index) => index);
        if (selectedRows.length > 0 && selectedRows.length === lyrics.length) {
            ret = [];
        }
        onSelectChange(ret);
    }, [isEditing, selectedRows, lyrics, onSelectChange])

    // 行编辑状态判断
    const isEditingLine = (rowIndex) => {
        if (readonly) return false;
        return editingRowIndex === rowIndex;
    }

    // 行编辑状态设置
    const handleSetEditing = (e, rowIndex, rowItem) => {
        e.stopPropagation();
        setEditingRow(rowItem);
        setEditingRowIndex(rowIndex);
    }

    // 行编辑取消事件处理
    const handleCancelEdit = (e) => {
        e.stopPropagation();
        setEditingRow(null);
        setEditingRowIndex(-1);
    }

    // 行编辑内容变化事件处理
    const handleEditorChange = (mod) => (event) => {
        setEditingRow({ ...editingRow, [mod]: event.target.value });
    }

    // 行编辑确认事件处理
    const handleAcceptEdit = (e) => {
        e.stopPropagation();
        onUpdate(editingRowIndex, editingRow);
        setEditingRow(null);
        setEditingRowIndex(-1);
    }

    // 行编辑输入框按下回车键事件处理
    const handleInputKeyDown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAcceptEdit();
        }
    }

    const headCells = [
        {
            id: 'time',
            align: 'left',
            label: '时间戳',
        },
        {
            id: 'content',
            align: 'left',
            label: '歌词',
        },
        {
            id: 'operate',
            label: '操作',
        },
    ];

    return <TableContainer>
        <Table size="small">
            <TableHead>
                <TableRow>
                    <TableCell padding="checkbox">
                        <Checkbox
                            readOnly={isEditing}
                            color="primary"
                            indeterminate={selectedRows.length > 0 && selectedRows.length < lyrics.length}
                            checked={selectedRows.length > 0 && selectedRows.length === lyrics.length}
                            onChange={handleSelectAllLine}
                            inputProps={{'aria-label': '全选'}}
                        />
                    </TableCell>
                    {headCells.map((headCell) => {
                        if (readonly && headCell.id === 'operate') return null;
                        return <TableCell
                            key={headCell.id}
                            align={headCell.align}
                        >
                            {headCell.label}
                        </TableCell>
                    })}
                </TableRow>
            </TableHead>
            <TableBody>
                {lyrics.map((row, index) => {
                    const isItemSelected = selectedRows.indexOf(index) > -1;
                    const labelId = `lyric-item-${index}`;

                    return (
                        <TableRow
                            hover
                            className={currentLrc?.index === index ? "player-lyric-editor-current-play-row" : ''}
                            role="checkbox"
                            tabIndex={-1}
                            key={`row_${index}_${row?.timestamp}_${row?.content}`}
                            selected={isItemSelected}
                            onClick={(e) => handleSelectLine({ target: { checked: !isItemSelected }}, index)}
                            sx={{ cursor: 'pointer' }}
                        >
                            <TableCell padding="checkbox">
                                <Checkbox
                                    readOnly={isEditing}
                                    onChange={(e) => handleSelectLine(e, index)}
                                    color="primary"
                                    checked={isItemSelected}
                                    inputProps={{
                                        'aria-labelledby': labelId,
                                    }}
                                />
                            </TableCell>
                            <TableCell>
                                {isEditingLine(index) ? <Input
                                    value={editingRow?.timestamp}
                                    variant="filled"
                                    size="small"
                                    type="number"
                                    onChange={handleEditorChange('timestamp')}
                                    onKeyDown={handleInputKeyDown}
                                /> : formatTimeLyric(row?.timestamp)}
                            </TableCell>
                            <TableCell>
                                {isEditingLine(index) ?  <Input
                                    value={editingRow?.content}
                                    variant="filled"
                                    fullWidth
                                    size="small"
                                    onChange={handleEditorChange('content')}
                                    onKeyDown={handleInputKeyDown}
                                /> : <Typography noWrap>{row?.content}</Typography>}
                            </TableCell>
                            {!readonly ? <TableCell>
                                {isEditing ? (isEditingLine(index) ?
                                    <>
                                        <IconButton size="small" onClick={handleAcceptEdit}>
                                            <CheckIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={handleCancelEdit}>
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </>
                                : null) : <>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleSetEditing(e, index, row)}
                                    >
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </>}
                            </TableCell>: null}
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    </TableContainer>
};

LyricEditorTable.propTypes = {
    lyrics: PropTypes.array.isRequired,
    readonly: PropTypes.bool,
    onUpdate: PropTypes.func,
    onSelectChange: PropTypes.func,
};

export default LyricEditorTable;