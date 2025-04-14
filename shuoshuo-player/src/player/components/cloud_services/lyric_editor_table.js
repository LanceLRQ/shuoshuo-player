import React from 'react';
import {
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    Checkbox,
    TableBody,
    Button,
    TextField
} from '@mui/material';
import PropTypes from "prop-types";
import {formatTimeLyric} from "@/utils";

const LyricEditorTable = (props) => {
    const { lyrics = [] } = props;

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

    const isSelected = (rowIndex) => {}

    return <TableContainer>
        <Table
            size="small"
        >
            <TableHead>
                <TableRow>
                    <TableCell padding="checkbox">
                        <Checkbox
                            color="primary"
                            // indeterminate={numSelected > 0 && numSelected < rowCount}
                            // checked={rowCount > 0 && numSelected === rowCount}
                            // onChange={onSelectAllClick}
                            inputProps={{
                                'aria-label': '全选',
                            }}
                        />
                    </TableCell>
                    {headCells.map((headCell) => (
                        <TableCell
                            key={headCell.id}
                            align={headCell.align}
                        >
                            {headCell.label}
                        </TableCell>
                    ))}
                </TableRow>
            </TableHead>
            <TableBody>
                {lyrics.map((row, index) => {
                    const isItemSelected = isSelected(index);
                    const labelId = `lyric-item-${index}`;

                    return (
                        <TableRow
                            hover
                            // onClick={(event) => handleClick(event, row.id)}
                            role="checkbox"
                            aria-checked={isItemSelected}
                            tabIndex={-1}
                            key={index}
                            selected={isItemSelected}
                            sx={{ cursor: 'pointer' }}
                        >
                            <TableCell padding="checkbox">
                                <Checkbox
                                    color="primary"
                                    checked={isItemSelected}
                                    inputProps={{
                                        'aria-labelledby': labelId,
                                    }}
                                />
                            </TableCell>
                            <TableCell>
                                {formatTimeLyric(row?.timestamp)}
                            </TableCell>
                            <TableCell>
                                <TextField
                                    hiddenLabel
                                    value={row?.content}
                                    variant="filled"
                                    fullWidth
                                    size="small"
                                />
                            </TableCell>
                            <TableCell align="right" padding="none">
                                <Button>test</Button>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    </TableContainer>
};

LyricEditorTable.propTypes = {
    lyrics: PropTypes.array.isRequired,
};

export default LyricEditorTable;