// api/todos.js - Supabase serverless function for Vercel
console.log('Node.js version:', process.version);

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        switch (req.method) {
            case 'GET':
                // GET /api/todos - Get all todos
                const { data: todos, error: getError } = await supabase
                    .from('todos')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (getError) {
                    console.error('Error fetching todos:', getError);
                    throw getError;
                }
                
                return res.status(200).json(todos || []);

            case 'POST':
                // POST /api/todos - Create a new todo
                const { text } = req.body;
                
                if (!text || text.trim() === '') {
                    return res.status(400).json({ error: 'Todo text is required' });
                }

                const { data: newTodo, error: postError } = await supabase
                    .from('todos')
                    .insert([
                        {
                            text: text.trim(),
                            completed: false
                        }
                    ])
                    .select()
                    .single();

                if (postError) {
                    console.error('Error creating todo:', postError);
                    throw postError;
                }
                
                return res.status(201).json(newTodo);

            case 'PUT':
                if (req.query.id) {
                    // PUT /api/todos?id=123 - Update specific todo
                    const todoId = parseInt(req.query.id);
                    const { text, completed } = req.body;

                    if (isNaN(todoId)) {
                        return res.status(400).json({ error: 'Invalid todo ID' });
                    }

                    const updateData = {};
                    if (text !== undefined) updateData.text = text.trim();
                    if (completed !== undefined) updateData.completed = Boolean(completed);

                    const { data: updatedTodo, error: putError } = await supabase
                        .from('todos')
                        .update(updateData)
                        .eq('id', todoId)
                        .select()
                        .single();

                    if (putError) {
                        console.error('Error updating todo:', putError);
                        if (putError.code === 'PGRST116') {
                            return res.status(404).json({ error: 'Todo not found' });
                        }
                        throw putError;
                    }
                    
                    return res.status(200).json(updatedTodo);
                } else {
                    // PUT /api/todos - Bulk replace (for file import feature)
                    const todos = req.body;

                    if (!Array.isArray(todos)) {
                        return res.status(400).json({ error: 'Todos must be an array' });
                    }

                    // Clear existing todos and insert new ones
                    const { error: deleteError } = await supabase
                        .from('todos')
                        .delete()
                        .neq('id', 0);

                    if (deleteError) {
                        console.error('Error clearing todos:', deleteError);
                        throw deleteError;
                    }

                    if (todos.length > 0) {
                        const validatedTodos = todos.map(todo => ({
                            text: todo.text || '',
                            completed: Boolean(todo.completed)
                        }));

                        const { data: insertedTodos, error: insertError } = await supabase
                            .from('todos')
                            .insert(validatedTodos)
                            .select();

                        if (insertError) {
                            console.error('Error inserting todos:', insertError);
                            throw insertError;
                        }

                        return res.status(200).json({ 
                            message: 'All todos updated successfully', 
                            count: insertedTodos.length 
                        });
                    }

                    return res.status(200).json({ 
                        message: 'All todos cleared successfully', 
                        count: 0 
                    });
                }

            case 'DELETE':
                if (req.query.id) {
                    // DELETE /api/todos?id=123 - Delete specific todo
                    const todoId = parseInt(req.query.id);
                    
                    if (isNaN(todoId)) {
                        return res.status(400).json({ error: 'Invalid todo ID' });
                    }

                    const { data: deletedTodo, error: deleteError } = await supabase
                        .from('todos')
                        .delete()
                        .eq('id', todoId)
                        .select()
                        .single();

                    if (deleteError) {
                        console.error('Error deleting todo:', deleteError);
                        if (deleteError.code === 'PGRST116') {
                            return res.status(404).json({ error: 'Todo not found' });
                        }
                        throw deleteError;
                    }
                    
                    return res.status(200).json({ 
                        message: 'Todo deleted successfully', 
                        todo: deletedTodo 
                    });
                } else {
                    // DELETE /api/todos - Delete all todos
                    const { error: deleteAllError } = await supabase
                        .from('todos')
                        .delete()
                        .neq('id', 0); // Delete all records

                    if (deleteAllError) {
                        console.error('Error deleting all todos:', deleteAllError);
                        throw deleteAllError;
                    }
                    
                    return res.status(200).json({ message: 'All todos deleted successfully' });
                }

            default:
                return res.status(405).json({ error: `Method ${req.method} not allowed` });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: error.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
}